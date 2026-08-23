import {getDelegateByActorAccountID, getThreadSummaryAccountIDs} from '@pages/inbox/report/ReportActionItemThread';

import CONST from '@src/CONST';
import type {ReportAction, ReportActions} from '@src/types/onyx';

import createRandomReportAction from '../utils/collections/reportActions';

const COPILOT_ACCOUNT_ID = 100;
const ACTED_FOR_ACCOUNT_ID = 200;

function buildReportAction(overrides: Partial<ReportAction>): ReportAction {
    return {
        ...createRandomReportAction(1),
        actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT,
        actorAccountID: ACTED_FOR_ACCOUNT_ID,
        delegateAccountID: undefined,
        ...overrides,
    };
}

/**
 * A copilot posts on behalf of another account, so the message's actorAccountID is the acted-for account and the
 * copilot is carried in delegateAccountID. `childOldestFourAccountIDs` only stores the acted-for account.
 */
function buildParentAction(hasDelegate: boolean): ReportAction {
    return buildReportAction({
        actorAccountID: ACTED_FOR_ACCOUNT_ID,
        delegateAccountID: hasDelegate ? COPILOT_ACCOUNT_ID : undefined,
        childOldestFourAccountIDs: String(ACTED_FOR_ACCOUNT_ID),
    });
}

function buildThreadReply(hasDelegate: boolean): ReportActions {
    return {
        reply: buildReportAction({
            reportActionID: 'reply',
            actorAccountID: ACTED_FOR_ACCOUNT_ID,
            delegateAccountID: hasDelegate ? COPILOT_ACCOUNT_ID : undefined,
        }),
    };
}

describe('ReportActionItemThread thread summary avatars', () => {
    describe('getDelegateByActorAccountID', () => {
        it('maps the acted-for actor to the copilot when a reply was made via a copilot', () => {
            expect(getDelegateByActorAccountID(buildThreadReply(true))).toEqual({[ACTED_FOR_ACCOUNT_ID]: COPILOT_ACCOUNT_ID});
        });

        it('returns an empty map when the acted-for account replied on its own', () => {
            expect(getDelegateByActorAccountID(buildThreadReply(false))).toEqual({});
        });

        it('returns undefined when the thread actions are not loaded (distinct from a loaded thread with no copilot replies)', () => {
            expect(getDelegateByActorAccountID(undefined)).toBeUndefined();
        });
    });

    describe('getThreadSummaryAccountIDs', () => {
        it('case A: copilot posted and the acted-for account replied itself -> shows the acted-for account', () => {
            const accountIDs = getThreadSummaryAccountIDs(buildParentAction(true), getDelegateByActorAccountID(buildThreadReply(false)));
            expect(accountIDs).toEqual([ACTED_FOR_ACCOUNT_ID]);
        });

        it('case B: acted-for posted and the copilot replied -> shows the copilot', () => {
            const accountIDs = getThreadSummaryAccountIDs(buildParentAction(false), getDelegateByActorAccountID(buildThreadReply(true)));
            expect(accountIDs).toEqual([COPILOT_ACCOUNT_ID]);
        });

        it('case C (reported): copilot posted and the copilot replied -> shows the copilot', () => {
            const accountIDs = getThreadSummaryAccountIDs(buildParentAction(true), getDelegateByActorAccountID(buildThreadReply(true)));
            expect(accountIDs).toEqual([COPILOT_ACCOUNT_ID]);
        });

        it('case D (reported, thread actions not loaded): falls back to the parent copilot -> shows the copilot', () => {
            const accountIDs = getThreadSummaryAccountIDs(buildParentAction(true), getDelegateByActorAccountID(undefined));
            expect(accountIDs).toEqual([COPILOT_ACCOUNT_ID]);
        });

        it('does not fall back when the thread is loaded but the acted-for account replied itself', () => {
            const accountIDs = getThreadSummaryAccountIDs(buildParentAction(true), getDelegateByActorAccountID(buildThreadReply(false)));
            expect(accountIDs).toEqual([ACTED_FOR_ACCOUNT_ID]);
        });

        it('no copilot anywhere: leaves the account IDs unchanged', () => {
            const accountIDs = getThreadSummaryAccountIDs(buildParentAction(false), getDelegateByActorAccountID(buildThreadReply(false)));
            expect(accountIDs).toEqual([ACTED_FOR_ACCOUNT_ID]);
        });
    });
});
