import {isSelfDM} from '@libs/ReportUtils';
import {getChildTransactions} from '@libs/TransactionUtils';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxTypes from '@src/types/onyx';

import type {OnyxCollection} from 'react-native-onyx';

/**
 * Reproducible micro-benchmark for issue #97802.
 *
 * On a high-traffic account, pressing Save on the split-expense page runs the SAME whole-collection
 * scan several times inside one synchronous press:
 *   - getChildTransactions(allTransactions, ..., false)  -> flow entry + updateSplitTransactions   (2x)
 *   - Object.values(allTransactions).filter(reportID === expenseReportID)                          (2x in the flow)
 *   - Object.values(allReports).find(isSelfDM)                                                      (1x full report scan)
 *
 * The PR computes each once and reuses / passes it down. This bench measures the pure scan cost the
 * PR removes, on a realistically sized synthetic account. It uses the REAL production helpers.
 */

const TRANSACTION_COUNT = 8000;
const REPORT_COUNT = 4000;
const CHILD_COUNT = 4;
const ITERATIONS = 200;

const originalTransactionID = 'original-123';
const expenseReportID = 'report-500';
const selfDMReportID = 'report-self-dm';

function buildTransactions(): OnyxCollection<OnyxTypes.Transaction> {
    const collection: Record<string, OnyxTypes.Transaction> = {};
    for (let i = 0; i < TRANSACTION_COUNT; i++) {
        const key = `${ONYXKEYS.COLLECTION.TRANSACTION}tx-${i}`;
        collection[key] = {
            transactionID: `tx-${i}`,
            reportID: `report-${i % REPORT_COUNT}`,
            amount: 100,
            comment: {},
        } as OnyxTypes.Transaction;
    }
    // A handful of real split children of the original transaction, living in the expense report.
    for (let c = 0; c < CHILD_COUNT; c++) {
        const key = `${ONYXKEYS.COLLECTION.TRANSACTION}child-${c}`;
        collection[key] = {
            transactionID: `child-${c}`,
            reportID: expenseReportID,
            amount: 25,
            comment: {originalTransactionID, source: CONST.IOU.TYPE.SPLIT},
        } as OnyxTypes.Transaction;
    }
    return collection;
}

function buildReports(): OnyxCollection<OnyxTypes.Report> {
    const collection: Record<string, OnyxTypes.Report> = {};
    for (let i = 0; i < REPORT_COUNT; i++) {
        const key = `${ONYXKEYS.COLLECTION.REPORT}report-${i}`;
        collection[key] = {reportID: `report-${i}`, chatType: CONST.REPORT.CHAT_TYPE.POLICY_EXPENSE_CHAT} as OnyxTypes.Report;
    }
    // The self-DM report is the LAST one inserted, so a find()-scan pays the worst case.
    collection[`${ONYXKEYS.COLLECTION.REPORT}${selfDMReportID}`] = {
        reportID: selfDMReportID,
        chatType: CONST.REPORT.CHAT_TYPE.SELF_DM,
    } as OnyxTypes.Report;
    return collection;
}

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
}

describe('SplitExpense Save — redundant collection scans (#97802)', () => {
    const allTransactions = buildTransactions();
    const allReports = buildReports();

    const reportFilter = (coll: OnyxCollection<OnyxTypes.Transaction>) => Object.values(coll ?? {}).filter((t) => t?.reportID === expenseReportID);

    // Old press path: the scans that run today.
    const oldPath = () => {
        const a = getChildTransactions(allTransactions, originalTransactionID, false); // flow entry
        const b = getChildTransactions(allTransactions, originalTransactionID, false); // updateSplitTransactions
        const c = reportFilter(allTransactions); // L2012
        const d = reportFilter(allTransactions); // L2023 (identical predicate)
        const e = Object.values(allReports ?? {}).find((r) => isSelfDM(r)); // L361 full report scan
        return a.length + b.length + c.length + d.length + (e ? 1 : 0);
    };

    // New press path: compute once, reuse / keyed lookup.
    const newPath = () => {
        const a = getChildTransactions(allTransactions, originalTransactionID, false); // computed once, passed down
        const c = reportFilter(allTransactions); // computed once, reused
        const e = allReports?.[`${ONYXKEYS.COLLECTION.REPORT}${selfDMReportID}`]; // keyed O(1) lookup
        return a.length + a.length + c.length + c.length + (e ? 1 : 0);
    };

    it('produces identical results old vs new', () => {
        expect(oldPath()).toEqual(newPath());
    });

    // Time a batch of `reps` calls with nanosecond resolution, return per-press ms. Take the best
    // (min) of several trials to reject GC/scheduler noise — standard micro-benchmark practice.
    const timePerPress = (fn: () => number, reps: number, trials: number) => {
        let best = Infinity;
        for (let t = 0; t < trials; t++) {
            const start = process.hrtime.bigint();
            for (let i = 0; i < reps; i++) {
                fn();
            }
            const ns = Number(process.hrtime.bigint() - start);
            best = Math.min(best, ns / reps / 1e6);
        }
        return best;
    };

    it('measures the scan cost removed by the PR', () => {
        // Warm up
        for (let i = 0; i < 50; i++) {
            oldPath();
            newPath();
        }
        const oldMed = timePerPress(oldPath, ITERATIONS, 10);
        const newMed = timePerPress(newPath, ITERATIONS, 10);
        const saved = oldMed - newMed;
        const pct = (saved / oldMed) * 100;

        const report = [
            '================ #97802 Split Save — redundant scan benchmark ================',
            `Synthetic account: ${TRANSACTION_COUNT} transactions, ${REPORT_COUNT} reports, ${CHILD_COUNT} split children`,
            `OLD press-path scans (best per-press):  ${oldMed.toFixed(4)} ms`,
            `NEW press-path scans (best per-press):  ${newMed.toFixed(4)} ms`,
            `Removed per Save press:                 ${saved.toFixed(3)} ms  (-${pct.toFixed(1)}%)`,
            '=============================================================================',
        ].join('\n');
        process.stdout.write(`\n${report}\n`);
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('fs').writeFileSync(process.env.BENCH_OUT ?? '/tmp/split_bench.txt', report);

        expect(newMed).toBeLessThan(oldMed);
    });
});
