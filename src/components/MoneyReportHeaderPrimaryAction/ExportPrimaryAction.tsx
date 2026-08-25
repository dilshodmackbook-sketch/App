import Button from '@components/ButtonComposed';

import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import usePaginatedReportActions from '@hooks/usePaginatedReportActions';

import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import {getValidConnectedIntegration} from '@libs/PolicyUtils';
import {getFilteredReportActionsForReportView} from '@libs/ReportActionsUtils';
import {isExported as isExportedUtils, isExportInProgress as isExportInProgressUtils} from '@libs/ReportUtils';

import {exportToIntegration} from '@userActions/Report';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';

import React from 'react';

type ExportPrimaryActionProps = {
    reportID: string | undefined;
    onExportModalOpen: () => void;
};

function ExportPrimaryAction({reportID, onExportModalOpen}: ExportPrimaryActionProps) {
    const {translate} = useLocalize();
    const [moneyRequestReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportID}`);
    const [reportMetadata] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_METADATA}${reportID}`);
    const [policy] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${getNonEmptyStringOnyxID(moneyRequestReport?.policyID)}`);
    const connectedIntegration = getValidConnectedIntegration(policy);

    const {reportActions: unfilteredReportActions} = usePaginatedReportActions(moneyRequestReport?.reportID);
    const reportActions = getFilteredReportActionsForReportView(unfilteredReportActions);
    const isExported = isExportedUtils(reportActions, moneyRequestReport);
    // Defensive guard: the primary-action gate (`isExportAction`) already hides this button while an export is in
    // flight, but guarding the press too prevents a duplicate export from any brief race before the gate re-evaluates.
    const isExportInProgress = isExportInProgressUtils(reportActions, moneyRequestReport, reportMetadata);

    return (
        <Button
            variant={CONST.BUTTON_VARIANT.SUCCESS}
            onPress={() => {
                if (!connectedIntegration || !moneyRequestReport || isExportInProgress) {
                    return;
                }
                if (isExported) {
                    onExportModalOpen();
                    return;
                }
                exportToIntegration(moneyRequestReport.reportID, connectedIntegration);
            }}
        >
            <Button.Text>
                {translate(
                    'workspace.common.exportIntegrationSelected',
                    // connectedIntegration is guaranteed non-null when EXPORT_TO_ACCOUNTING is the primary action
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    connectedIntegration!,
                )}
            </Button.Text>
        </Button>
    );
}

export default ExportPrimaryAction;
