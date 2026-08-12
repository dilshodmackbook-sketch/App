import {renderHook} from '@testing-library/react-native';

import useConciergeSidePanelReportActions from '@hooks/useConciergeSidePanelReportActions';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report, ReportAction} from '@src/types/onyx';

import Onyx from 'react-native-onyx';

import createRandomReportAction from '../../utils/collections/reportActions';
import {createRandomReport} from '../../utils/collections/reports';
import waitForBatchedUpdates from '../../utils/waitForBatchedUpdates';

const REPORT_ID = '1';
const CURRENT_USER_ACCOUNT_ID = 1;
const CONCIERGE_ACCOUNT_ID = 2;
const OPEN_MS = Date.UTC(2026, 5, 29, 10, 0, 0);

function toDBTime(ms: number): string {
    return new Date(ms).toISOString().replace('T', ' ').replace('Z', '');
}

function buildAction(reportActionID: string, overrides: Partial<ReportAction>): ReportAction {
    return {
        ...createRandomReportAction(Number(reportActionID)),
        reportActionID,
        actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT,
        actorAccountID: CURRENT_USER_ACCOUNT_ID,
        pendingAction: undefined,
        ...overrides,
    };
}

function buildTaskAction(reportActionID: string, stateNum: number, statusNum: number, createdMs: number): ReportAction {
    return buildAction(reportActionID, {
        actorAccountID: CONCIERGE_ACCOUNT_ID,
        created: toDBTime(createdMs),
        childReportID: `child-${reportActionID}`,
        childType: CONST.REPORT.TYPE.TASK,
        childStateNum: stateNum,
        childStatusNum: statusNum,
    });
}

/**
 * Main-DM Concierge, existing account, fresh session boundary. `showFullHistory` is passed as `false`
 * to reflect the call site after the blanket `report.hasOutstandingChildTask` clause is dropped from
 * useReportActionsListModel — so hiding and the "Show history" button behave normally.
 */
function renderMainDM() {
    const sessionStartTime = toDBTime(OPEN_MS);
    const createdAction = buildAction('10', {actionName: CONST.REPORT.ACTIONS.TYPE.CREATED, created: toDBTime(OPEN_MS - 7_200_000)});
    const preSessionUser = buildAction('11', {created: toDBTime(OPEN_MS - 3_600_000)});
    const openTask = buildTaskAction('13', CONST.REPORT.STATE_NUM.OPEN, CONST.REPORT.STATUS_NUM.OPEN, OPEN_MS - 3_000_000);
    const completedTask = buildTaskAction('14', CONST.REPORT.STATE_NUM.APPROVED, CONST.REPORT.STATUS_NUM.APPROVED, OPEN_MS - 2_900_000);
    const openThread = buildAction('15', {
        created: toDBTime(OPEN_MS - 2_800_000),
        childReportID: 'child-15',
        childType: CONST.REPORT.TYPE.CHAT,
        childStateNum: CONST.REPORT.STATE_NUM.OPEN,
        childStatusNum: CONST.REPORT.STATUS_NUM.OPEN,
    });
    const question = buildAction('20', {created: toDBTime(OPEN_MS + 2000)});
    const reply = buildAction('21', {actorAccountID: CONCIERGE_ACCOUNT_ID, created: toDBTime(OPEN_MS + 4000)});
    const reportActions = [createdAction, preSessionUser, openTask, completedTask, openThread, question, reply];

    const report: Report = {...createRandomReport(Number(REPORT_ID)), reportID: REPORT_ID, lastReadTime: sessionStartTime, hasOutstandingChildTask: true};

    return renderHook(() =>
        useConciergeSidePanelReportActions({
            report,
            reportActions,
            visibleReportActions: reportActions,
            isConciergeHiddenHistory: true,
            hasUserSentMessage: true,
            hasOlderActions: false,
            sessionStartTime,
            currentUserAccountID: CURRENT_USER_ACCOUNT_ID,
            greetingText: 'Hi there, how can I help?',
            loadOlderChats: jest.fn(),
            isConciergeMainDM: true,
            showFullHistory: false,
        }),
    );
}

/** Fresh onboarding account: no prior user message before the session -> full history stays visible (unchanged). */
function renderOnboardingMainDM() {
    const sessionStartTime = toDBTime(OPEN_MS);
    const createdAction = buildAction('10', {actionName: CONST.REPORT.ACTIONS.TYPE.CREATED, created: toDBTime(OPEN_MS - 60_000)});
    const onboardingTask = buildTaskAction('13', CONST.REPORT.STATE_NUM.OPEN, CONST.REPORT.STATUS_NUM.OPEN, OPEN_MS - 30_000);
    const conciergeIntro = buildAction('12', {actorAccountID: CONCIERGE_ACCOUNT_ID, created: toDBTime(OPEN_MS - 20_000)});
    const reportActions = [createdAction, onboardingTask, conciergeIntro];

    const report: Report = {...createRandomReport(Number(REPORT_ID)), reportID: REPORT_ID, lastReadTime: sessionStartTime, hasOutstandingChildTask: true};

    return renderHook(() =>
        useConciergeSidePanelReportActions({
            report,
            reportActions,
            visibleReportActions: reportActions,
            isConciergeHiddenHistory: true,
            hasUserSentMessage: false,
            hasOlderActions: false,
            sessionStartTime,
            currentUserAccountID: CURRENT_USER_ACCOUNT_ID,
            greetingText: 'Hi there, how can I help?',
            loadOlderChats: jest.fn(),
            isConciergeMainDM: true,
            showFullHistory: false,
        }),
    );
}

describe('useConciergeSidePanelReportActions - main DM with an outstanding task', () => {
    beforeAll(() => Onyx.init({keys: ONYXKEYS}));
    beforeEach(async () => {
        await Onyx.clear();
        await waitForBatchedUpdates();
    });

    it('keeps an OPEN pre-session task visible while hiding the rest of read history and showing the button', () => {
        const {result} = renderMainDM();
        const visibleIDs = result.current.filteredReportActions.map((action) => action.reportActionID);

        // The pending OPEN task stays visible (the behavior 3b8d6040f65 introduced) ...
        expect(visibleIDs).toContain('13');
        // ... while the rest of the read history collapses behind "Show history" (the #97187 fix) ...
        expect(visibleIDs).not.toContain('11');
        // ... a completed task is not force-shown ...
        expect(visibleIDs).not.toContain('14');
        // ... and a non-task open thread is not pinned.
        expect(visibleIDs).not.toContain('15');
        // In-session content stays.
        expect(visibleIDs).toContain('20');
        expect(visibleIDs).toContain('21');
        // The "Show history" button renders (hasPreviousMessages && !showFullHistory).
        expect(result.current.hasPreviousMessages).toBe(true);
        expect(result.current.showFullHistory).toBe(false);
    });

    it('leaves a fresh onboarding account (no prior user message) with full history visible', () => {
        const {result} = renderOnboardingMainDM();
        const visibleIDs = result.current.filteredReportActions.map((action) => action.reportActionID);

        // No pre-session user message -> nothing is hidden; onboarding content (incl. the task) renders fully.
        expect(visibleIDs).toContain('13');
        expect(visibleIDs).toContain('12');
        expect(result.current.hasPreviousMessages).toBe(false);
    });
});
