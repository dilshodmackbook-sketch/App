import {getMoneyRequestInformation} from '@libs/actions/IOU/MoneyRequestBuilder';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Beta, PolicyTagLists, Report} from '@src/types/onyx';

import Onyx from 'react-native-onyx';

import waitForBatchedUpdates from '../../utils/waitForBatchedUpdates';

jest.mock('@src/libs/Navigation/Navigation', () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    navigationRef: {
        getCurrentRoute: jest.fn(() => ({name: 'Money_Request_Create', params: {}})),
        getState: jest.fn(() => ({})),
    },
}));

const POLICY_ID = 'policy-test-1';
const CHAT_REPORT_ID = 'report-chat-1';
const PAYEE_ACCOUNT_ID = 100;
const PAYER_ACCOUNT_ID = 200;
const TAG_LIST = 'Department';
const TAG_NAME = 'Engineering';

const parentChatReport: Report = {
    reportID: CHAT_REPORT_ID,
    chatType: CONST.REPORT.CHAT_TYPE.POLICY_EXPENSE_CHAT,
    policyID: POLICY_ID,
    isOwnPolicyExpenseChat: true,
    type: CONST.REPORT.TYPE.CHAT,
};

const policyTagListA: PolicyTagLists = {
    [TAG_LIST]: {
        name: TAG_LIST,
        orderWeight: 0,
        required: false,
        tags: {
            [TAG_NAME]: {
                name: TAG_NAME,
                enabled: true,
            },
        },
    },
};

const baseParams = {
    parentChatReport,
    participantParams: {
        payeeAccountID: PAYEE_ACCOUNT_ID,
        payeeEmail: 'payee@example.com',
        participant: {
            accountID: PAYER_ACCOUNT_ID,
            login: 'payer@example.com',
            isPolicyExpenseChat: true,
            reportID: CHAT_REPORT_ID,
        },
    },
    transactionParams: {
        amount: 1000,
        currency: 'USD',
        created: '2024-01-01',
        merchant: 'Test Merchant',
    },
    betas: [] as Beta[],
    isASAPSubmitBetaEnabled: false,
    currentUserAccountIDParam: PAYEE_ACCOUNT_ID,
    currentUserEmailParam: 'payee@example.com',
    transactionViolations: {},
    quickAction: undefined,
    policyRecentlyUsedCurrencies: [] as string[],
    personalDetails: {},
    delegateAccountID: undefined,
    isTrackIntentUser: false,
} as const;

describe('getMoneyRequestInformation', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
        return waitForBatchedUpdates();
    });

    beforeEach(async () => {
        await Onyx.clear();
        await waitForBatchedUpdates();
    });

    describe('optimistic recently used tags', () => {
        it('should store recently used tags at the correct policy key when policyTagList and tag are provided', () => {
            const result = getMoneyRequestInformation({
                ...baseParams,
                policyParams: {
                    policyTagList: policyTagListA,
                },
                transactionParams: {
                    ...baseParams.transactionParams,
                    tag: TAG_NAME,
                },
            });

            const expectedKey = `${ONYXKEYS.COLLECTION.POLICY_RECENTLY_USED_TAGS}${POLICY_ID}`;
            const tagEntry = result.onyxData.optimisticData?.find((entry) => entry.key === expectedKey);

            expect(tagEntry).toBeDefined();
            expect(tagEntry?.value).toEqual({[TAG_LIST]: [TAG_NAME]});
        });

        it('should not store recently used tags when tag is not provided', () => {
            const result = getMoneyRequestInformation({
                ...baseParams,
                policyParams: {
                    policyTagList: policyTagListA,
                },
            });

            const expectedKey = `${ONYXKEYS.COLLECTION.POLICY_RECENTLY_USED_TAGS}${POLICY_ID}`;
            const tagEntry = result.onyxData.optimisticData?.find((entry) => entry.key === expectedKey);

            expect(tagEntry).toBeUndefined();
        });

        it('should store tags under empty-string list key when policyTagList has no named tag lists', () => {
            const result = getMoneyRequestInformation({
                ...baseParams,
                policyParams: {
                    policyTagList: {},
                },
                transactionParams: {
                    ...baseParams.transactionParams,
                    tag: TAG_NAME,
                },
            });

            const expectedKey = `${ONYXKEYS.COLLECTION.POLICY_RECENTLY_USED_TAGS}${POLICY_ID}`;
            const tagEntry = result.onyxData.optimisticData?.find((entry) => entry.key === expectedKey);

            expect(tagEntry).toBeDefined();
            const value = tagEntry?.value as Record<string, string[]>;
            expect(value['']).toEqual([TAG_NAME]);
        });

        it('should use parentChatReport.policyID for the recently used tags key', () => {
            const otherPolicyID = 'policy-other';
            const result = getMoneyRequestInformation({
                ...baseParams,
                parentChatReport: {
                    ...parentChatReport,
                    policyID: otherPolicyID,
                },
                policyParams: {
                    policyTagList: policyTagListA,
                },
                transactionParams: {
                    ...baseParams.transactionParams,
                    tag: TAG_NAME,
                },
            });

            const expectedKey = `${ONYXKEYS.COLLECTION.POLICY_RECENTLY_USED_TAGS}${otherPolicyID}`;
            const wrongKey = `${ONYXKEYS.COLLECTION.POLICY_RECENTLY_USED_TAGS}${POLICY_ID}`;

            expect(result.onyxData.optimisticData?.find((entry) => entry.key === expectedKey)).toBeDefined();
            expect(result.onyxData.optimisticData?.find((entry) => entry.key === wrongKey)).toBeUndefined();
        });

        it('should use policyID from allReports when moneyRequestReportID is provided', async () => {
            const moneyRequestReportID = 'iou-report-lookup-1';
            const differentPolicyID = 'policy-different';
            await Onyx.set(ONYXKEYS.SESSION, {accountID: PAYEE_ACCOUNT_ID, email: 'payee@example.com'});
            await Onyx.set(`${ONYXKEYS.COLLECTION.POLICY}${differentPolicyID}`, {id: differentPolicyID, type: CONST.POLICY.TYPE.CORPORATE, name: 'Test Policy'});
            await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}${moneyRequestReportID}`, {
                reportID: moneyRequestReportID,
                policyID: differentPolicyID,
                type: CONST.REPORT.TYPE.EXPENSE,
                ownerAccountID: PAYEE_ACCOUNT_ID,
                currency: 'USD',
                total: 0,
            });
            await waitForBatchedUpdates();

            const result = getMoneyRequestInformation({
                ...baseParams,
                moneyRequestReportID,
                policyParams: {
                    policyTagList: policyTagListA,
                },
                transactionParams: {
                    ...baseParams.transactionParams,
                    tag: TAG_NAME,
                },
            });

            const expectedKey = `${ONYXKEYS.COLLECTION.POLICY_RECENTLY_USED_TAGS}${differentPolicyID}`;
            const wrongKey = `${ONYXKEYS.COLLECTION.POLICY_RECENTLY_USED_TAGS}${POLICY_ID}`;

            expect(result.onyxData.optimisticData?.find((entry) => entry.key === expectedKey)).toBeDefined();
            expect(result.onyxData.optimisticData?.find((entry) => entry.key === wrongKey)).toBeUndefined();
        });

        it('should fall back to parentChatReport.policyID when moneyRequestReportID is empty string', () => {
            const result = getMoneyRequestInformation({
                ...baseParams,
                moneyRequestReportID: '',
                policyParams: {
                    policyTagList: policyTagListA,
                },
                transactionParams: {
                    ...baseParams.transactionParams,
                    tag: TAG_NAME,
                },
            });

            const expectedKey = `${ONYXKEYS.COLLECTION.POLICY_RECENTLY_USED_TAGS}${POLICY_ID}`;
            const tagEntry = result.onyxData.optimisticData?.find((entry) => entry.key === expectedKey);

            expect(tagEntry).toBeDefined();
            expect(tagEntry?.value).toEqual({[TAG_LIST]: [TAG_NAME]});
        });
    });

    describe('reusing an outstanding report after a partial approval', () => {
        const APPROVER_ACCOUNT_ID = 300;
        const APPROVED_REPORT_ID = 'report-approved-1';
        const HELD_REPORT_ID = 'report-held-1';

        beforeEach(async () => {
            // Session must be the submitter so `canAddTransaction` (isCurrentUserSubmitter) passes for the held report.
            await Onyx.set(ONYXKEYS.SESSION, {accountID: PAYEE_ACCOUNT_ID, email: 'payee@example.com'});
            await Onyx.set(ONYXKEYS.PERSONAL_DETAILS_LIST, {
                [PAYEE_ACCOUNT_ID]: {accountID: PAYEE_ACCOUNT_ID, login: 'payee@example.com'},
                [APPROVER_ACCOUNT_ID]: {accountID: APPROVER_ACCOUNT_ID, login: 'approver@example.com'},
            });
            await Onyx.set(`${ONYXKEYS.COLLECTION.POLICY}${POLICY_ID}`, {
                id: POLICY_ID,
                type: CONST.POLICY.TYPE.CORPORATE,
                name: 'Test Policy',
                approvalMode: CONST.POLICY.APPROVAL_MODE.BASIC,
                approver: 'approver@example.com',
                owner: 'approver@example.com',
                role: CONST.POLICY.ROLE.USER,
            });
            // The report the chat still points to on the submitter's client: the just-approved report, which is NOT addable.
            await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}${APPROVED_REPORT_ID}`, {
                reportID: APPROVED_REPORT_ID,
                policyID: POLICY_ID,
                type: CONST.REPORT.TYPE.EXPENSE,
                ownerAccountID: PAYEE_ACCOUNT_ID,
                managerID: APPROVER_ACCOUNT_ID,
                stateNum: CONST.REPORT.STATE_NUM.APPROVED,
                statusNum: CONST.REPORT.STATUS_NUM.APPROVED,
                currency: 'USD',
                total: 0,
            });
            // The still-outstanding report holding the on-hold expense; PROCESSING and awaiting first-level approval → addable.
            await Onyx.set(`${ONYXKEYS.COLLECTION.REPORT}${HELD_REPORT_ID}`, {
                reportID: HELD_REPORT_ID,
                policyID: POLICY_ID,
                type: CONST.REPORT.TYPE.EXPENSE,
                ownerAccountID: PAYEE_ACCOUNT_ID,
                managerID: APPROVER_ACCOUNT_ID,
                stateNum: CONST.REPORT.STATE_NUM.SUBMITTED,
                statusNum: CONST.REPORT.STATUS_NUM.SUBMITTED,
                currency: 'USD',
                total: 0,
            });
            await waitForBatchedUpdates();
        });

        it('reuses the outstanding held report instead of creating a brand-new one when the chat pointer is stale', () => {
            const result = getMoneyRequestInformation({
                ...baseParams,
                // On the submitter's client the chat still points at the approved report (the approve-flow repoint only ran on the approver's client).
                parentChatReport: {...parentChatReport, iouReportID: APPROVED_REPORT_ID},
            });

            expect(result.iouReport.reportID).toBe(HELD_REPORT_ID);
        });

        it('still creates a new report when there is no outstanding report to reuse', async () => {
            await Onyx.merge(`${ONYXKEYS.COLLECTION.REPORT}${HELD_REPORT_ID}`, {
                stateNum: CONST.REPORT.STATE_NUM.APPROVED,
                statusNum: CONST.REPORT.STATUS_NUM.APPROVED,
            });
            await waitForBatchedUpdates();

            const result = getMoneyRequestInformation({
                ...baseParams,
                parentChatReport: {...parentChatReport, iouReportID: APPROVED_REPORT_ID},
            });

            expect(result.iouReport.reportID).not.toBe(HELD_REPORT_ID);
            expect(result.iouReport.reportID).not.toBe(APPROVED_REPORT_ID);
        });
    });

    describe('pendingNewTransactionIDs metadata rail', () => {
        // Only the 0→1 negative is testable here (the resolved report has no existing txs); the >= 1 positive path lives in the useNewTransactions consumer tests.
        it('does NOT flag the first transaction of a report (no stale flag to re-highlight the original on a later add)', () => {
            const result = getMoneyRequestInformation(baseParams);
            const expectedKey = `${ONYXKEYS.COLLECTION.REPORT_METADATA}${result.iouReport.reportID}`;
            const newTxID = result.transaction.transactionID;

            expect(result.onyxData.optimisticData ?? []).not.toEqual(
                expect.arrayContaining([expect.objectContaining({key: expectedKey, value: expect.objectContaining({pendingNewTransactionIDs: expect.objectContaining({[newTxID]: true})})})]),
            );
        });
    });
});
