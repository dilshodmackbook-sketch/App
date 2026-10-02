import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';

import ComposeProviders from '@components/ComposeProviders';
import {LocaleContextProvider} from '@components/LocaleContextProvider';
import {ModalProvider} from '@components/Modal/Global/ModalContext';
import OnyxListItemProvider from '@components/OnyxListItemProvider';

import {CurrentReportIDContextProvider} from '@hooks/useCurrentReportID';
import * as useResponsiveLayoutModule from '@hooks/useResponsiveLayout';
import type ResponsiveLayoutResult from '@hooks/useResponsiveLayout/types';

import createPlatformStackNavigator from '@libs/Navigation/PlatformStackNavigation/createPlatformStackNavigator';

import type {WorkspaceSplitNavigatorParamList} from '@navigation/types';

import WorkspaceWorkflowsPageRevamp from '@pages/workspace/workflows/WorkspaceWorkflowsPageRevamp';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import SCREENS from '@src/SCREENS';
import type {Policy} from '@src/types/onyx';
import type {PersonalDetailsList} from '@src/types/onyx/PersonalDetails';
import type {PolicyEmployeeList} from '@src/types/onyx/PolicyEmployee';

import {PortalProvider} from '@gorhom/portal';
import {NavigationContainer} from '@react-navigation/native';
import React from 'react';
import Onyx from 'react-native-onyx';

import * as LHNTestUtils from '../utils/LHNTestUtils';
import * as TestHelper from '../utils/TestHelper';
import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

jest.mock('@src/components/ConfirmedRoute.tsx');

TestHelper.setupGlobalFetchMock();

const POLICY_ID = 'workflows-smart-limit-lock-test';
const OWNER_EMAIL = 'test@user.com';
const OWNER_ACCOUNT_ID = 1;
const APPROVER_EMAIL = 'approver@example.com';
const APPROVER_ACCOUNT_ID = 2;
const MEMBER_EMAIL = 'member@example.com';
const MEMBER_ACCOUNT_ID = 3;

const Stack = createPlatformStackNavigator<WorkspaceSplitNavigatorParamList>();

const employeeList: PolicyEmployeeList = {
    [OWNER_EMAIL]: {email: OWNER_EMAIL, submitsTo: OWNER_EMAIL, forwardsTo: undefined},
    [APPROVER_EMAIL]: {email: APPROVER_EMAIL, submitsTo: undefined, forwardsTo: undefined},
    [MEMBER_EMAIL]: {email: MEMBER_EMAIL, submitsTo: APPROVER_EMAIL, forwardsTo: undefined},
};

const personalDetails: PersonalDetailsList = {
    [OWNER_ACCOUNT_ID]: TestHelper.buildPersonalDetails(OWNER_EMAIL, OWNER_ACCOUNT_ID, 'Owner'),
    [APPROVER_ACCOUNT_ID]: TestHelper.buildPersonalDetails(APPROVER_EMAIL, APPROVER_ACCOUNT_ID, 'Approver'),
    [MEMBER_ACCOUNT_ID]: TestHelper.buildPersonalDetails(MEMBER_EMAIL, MEMBER_ACCOUNT_ID, 'Member'),
};

const buildPolicy = (policyOverrides: Partial<Policy>): Policy =>
    ({
        ...LHNTestUtils.getFakePolicy(POLICY_ID),
        type: CONST.POLICY.TYPE.CORPORATE,
        role: CONST.POLICY.ROLE.ADMIN,
        owner: OWNER_EMAIL,
        approver: OWNER_EMAIL,
        outputCurrency: 'USD',
        areWorkflowsEnabled: true,
        reimbursementChoice: CONST.POLICY.REIMBURSEMENT_CHOICES.REIMBURSEMENT_NO,
        employeeList,
        ...policyOverrides,
    }) as Policy;

const setupPolicy = async (policyOverrides: Partial<Policy>) => {
    await act(async () => {
        await Onyx.merge(`${ONYXKEYS.COLLECTION.POLICY}${POLICY_ID}`, buildPolicy(policyOverrides));
        await Onyx.merge(ONYXKEYS.PERSONAL_DETAILS_LIST, personalDetails);
    });
};

const renderPage = () =>
    render(
        <ComposeProviders components={[OnyxListItemProvider, LocaleContextProvider, CurrentReportIDContextProvider]}>
            <PortalProvider>
                <ModalProvider>
                    <NavigationContainer>
                        <Stack.Navigator initialRouteName={SCREENS.WORKSPACE.WORKFLOWS}>
                            <Stack.Screen
                                name={SCREENS.WORKSPACE.WORKFLOWS}
                                component={WorkspaceWorkflowsPageRevamp}
                                initialParams={{policyID: POLICY_ID, tab: CONST.TAB.WORKFLOWS.APPROVALS}}
                            />
                        </Stack.Navigator>
                    </NavigationContainer>
                </ModalProvider>
            </PortalProvider>
        </ComposeProviders>,
    );

const lockedLabel = () => `${TestHelper.translateLocal('workspace.moreFeatures.workflows.disableApprovalPrompt')}, ${TestHelper.translateLocal('common.locked')}`;
const enableLabel = () => TestHelper.translateLocal('workflowsPage.addApprovalsDescription');

describe('WorkflowsApprovalsTab - Smart Limit approvals lock', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        await act(async () => {
            await Onyx.set(ONYXKEYS.NVP_PREFERRED_LOCALE, CONST.LOCALES.EN);
        });
        const wideLayout: ResponsiveLayoutResult = {
            shouldUseNarrowLayout: false,
            isSmallScreenWidth: false,
            isInNarrowPaneModal: false,
            isExtraSmallScreenHeight: false,
            isMediumScreenWidth: false,
            isLargeScreenWidth: true,
            isExtraLargeScreenWidth: false,
            isExtraSmallScreenWidth: false,
            isSmallScreen: false,
            onboardingIsMediumOrLargerScreenWidth: true,
            isInLandscapeMode: false,
        };
        jest.spyOn(useResponsiveLayoutModule, 'default').mockReturnValue(wideLayout);
        await TestHelper.signInWithTestUser(OWNER_ACCOUNT_ID, OWNER_EMAIL);
    });

    afterEach(async () => {
        await act(async () => {
            await Onyx.clear();
        });
        jest.clearAllMocks();
    });

    it('lets an admin turn approvals on when Smart Limit cards exist and approvals are off', async () => {
        // Given a workspace with Smart Limit cards whose approvals were turned off before the lock existed
        await setupPolicy({approvalMode: CONST.POLICY.APPROVAL_MODE.OPTIONAL, areApprovalsLockedByExpensifyCard: true});
        renderPage();
        await waitForBatchedUpdatesWithAct();

        // Then the switch is off and unlocked, because a press can only enable approvals
        const approvalsSwitch = screen.getByLabelText(enableLabel());
        expect(approvalsSwitch).not.toBeChecked();
        expect(screen.queryByLabelText(lockedLabel())).not.toBeOnTheScreen();

        // When the admin turns approvals on
        fireEvent.press(approvalsSwitch);

        // Then approvals are enabled and the lock re-engages so they can't be turned off again
        await waitFor(() => expect(screen.getByLabelText(lockedLabel())).toBeChecked());
    });

    it('keeps the switch locked when Smart Limit cards exist and approvals are on', async () => {
        // Given a workspace with Smart Limit cards and approvals on, where a press would disable approvals
        await setupPolicy({approvalMode: CONST.POLICY.APPROVAL_MODE.BASIC, areApprovalsLockedByExpensifyCard: true});
        renderPage();
        await waitForBatchedUpdatesWithAct();

        // Then the switch stays locked with the Smart Limit prompt
        expect(screen.getByLabelText(lockedLabel())).toBeChecked();
    });

    it('keeps the upgrade path reachable on a Submit workspace with Smart Limit cards', async () => {
        // Given a Submit workspace, which stores Advanced approvals but shows the switch as off
        await setupPolicy({type: CONST.POLICY.TYPE.SUBMIT, approvalMode: CONST.POLICY.APPROVAL_MODE.ADVANCED, areApprovalsLockedByExpensifyCard: true});
        renderPage();
        await waitForBatchedUpdatesWithAct();

        // Then the switch is not locked, since a press only opens the upgrade flow and can't disable approvals
        expect(screen.queryByLabelText(lockedLabel())).not.toBeOnTheScreen();
        expect(screen.getByLabelText(enableLabel())).not.toBeChecked();
    });

    it('does not lock the switch when the workspace has no Smart Limit cards', async () => {
        // Given a workspace with approvals on and no Smart Limit cards
        await setupPolicy({approvalMode: CONST.POLICY.APPROVAL_MODE.BASIC});
        renderPage();
        await waitForBatchedUpdatesWithAct();

        // Then the switch is on and unlocked, same as before
        expect(screen.getByLabelText(enableLabel())).toBeChecked();
    });
});
