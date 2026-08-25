import type CONST from '@src/CONST';

import type {ValueOf} from 'type-fest';

import type * as OnyxCommon from './OnyxCommon';

/** The pending member of report */
type PendingChatMember = {
    /** Account ID of the pending member */
    accountID: string;

    /** Action to be applied to the pending member of report */
    pendingAction: OnyxCommon.PendingAction;

    /** Collection of errors to show to the user */
    errors?: OnyxCommon.Errors;
};

/** Per-report business state. Loading flags, pagination cursors, and last-visit timestamps
 *  are tracked in dedicated Onyx keys (RAM_ONLY_REPORT_LOADING_STATE, REPORT_PAGINATION_STATE,
 *  REPORT_LAST_VISIT_TIMES) and are NOT part of this type. */
type ReportMetadata = {
    /** Whether the current report is optimistic */
    isOptimisticReport?: boolean;

    /** Pending members of the report */
    pendingChatMembers?: PendingChatMember[];

    /** Whether the report has violations or errors */
    errors?: OnyxCommon.Errors;

    /** Pending expense action for DEW policies (e.g., SUBMIT or APPROVE in progress) */
    pendingExpenseAction?: ValueOf<typeof CONST.EXPENSE_PENDING_ACTION>;

    /**
     * Snapshot captured when a user-started export to an accounting integration is fired. Client-only state (it is not
     * returned from the server), so it lives here rather than on the report. It lets the in-flight state hold in a
     * preview where the report actions are not loaded and survive a refresh, and is resolved at read time against the
     * report's own outcome fields rather than cleared from a listener, since `Report_Export` returns 200 and the real
     * outcome arrives later over Pusher. See `isExportInProgress` in `ReportUtils`.
     */
    pendingExport?: {
        /** Number of `errorFields.export` entries the report had when this export started; a larger count later means this attempt failed. */
        previousExportErrorCount: number;

        /** Whether the report was already exported when this export started; lets a later `isExportedToIntegration` flip read as success. */
        wasAlreadyExported: boolean;
    };

    /** Transaction IDs that were just submitted/moved to this report and should be highlighted on first load */
    pendingNewTransactionIDs?: Record<string, true | null>;
};

export default ReportMetadata;

export type {PendingChatMember};
