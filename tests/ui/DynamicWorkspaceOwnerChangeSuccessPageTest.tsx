import {render} from '@testing-library/react-native';

import type {PlatformStackScreenProps} from '@libs/Navigation/PlatformStackNavigation/types';

import type {SettingsNavigatorParamList} from '@navigation/types';

import DynamicWorkspaceOwnerChangeSuccessPage from '@pages/workspace/members/DynamicWorkspaceOwnerChangeSuccessPage';

import ONYXKEYS from '@src/ONYXKEYS';
import type SCREENS from '@src/SCREENS';

import React from 'react';
import Onyx from 'react-native-onyx';

import createMock from '../utils/createMock';
import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

const mockOpenPolicyProfilePage = jest.fn();
const mockClearWorkspaceOwnerChangeFlow = jest.fn();

// Capture the policy refresh the success page should trigger on mount.
jest.mock('@userActions/Policy/Policy', () => ({
    openPolicyProfilePage: (...args: unknown[]) => {
        mockOpenPolicyProfilePage(...args);
    },
}));

jest.mock('@userActions/Policy/Member', () => ({
    clearWorkspaceOwnerChangeFlow: (...args: unknown[]) => {
        mockClearWorkspaceOwnerChangeFlow(...args);
    },
}));

// Trim the presentational tree so the test targets the mount-time data refresh only.
jest.mock('@hooks/useLocalize', () => () => ({translate: (key: string) => key, formatPhoneNumber: (phone: string) => phone}));
jest.mock('@hooks/useThemeStyles', () => () => ({}));
jest.mock('@hooks/useDynamicBackPath', () => () => '');
jest.mock('@navigation/Navigation', () => ({goBack: jest.fn()}));
jest.mock('@components/ConfirmationPage', () => () => null);
jest.mock('@components/HeaderWithBackButton', () => () => null);
jest.mock(
    '@components/ScreenWrapper',
    () =>
        ({children}: {children: React.ReactNode}) =>
            children,
);
jest.mock('@components/LottieAnimations', () => ({Fireworks: {}}));
jest.mock(
    '@pages/workspace/AccessOrNotFoundWrapper',
    () =>
        ({children}: {children: React.ReactNode}) =>
            children,
);

const POLICY_ID = 'test-policy-id';

type SuccessPageProps = PlatformStackScreenProps<SettingsNavigatorParamList, typeof SCREENS.WORKSPACE.DYNAMIC_OWNER_CHANGE_SUCCESS>;

const navigationMock = createMock<SuccessPageProps['navigation']>({});
const routeMock = createMock<SuccessPageProps['route']>({params: {policyID: POLICY_ID, accountID: 1}});

const renderPage = () =>
    render(
        <DynamicWorkspaceOwnerChangeSuccessPage
            route={routeMock}
            navigation={navigationMock}
        />,
    );

describe('DynamicWorkspaceOwnerChangeSuccessPage', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        mockOpenPolicyProfilePage.mockReset();
        mockClearWorkspaceOwnerChangeFlow.mockReset();
        await Onyx.clear();
        await Onyx.set(`${ONYXKEYS.COLLECTION.POLICY}${POLICY_ID}`, {
            // Minimal successfully-transferred policy state that lets the success screen mount.
            id: POLICY_ID,
            isChangeOwnerSuccessful: true,
        });
    });

    it('refreshes the policy (OpenPolicyProfilePage) when the success screen mounts after a completed transfer', async () => {
        renderPage();
        await waitForBatchedUpdatesWithAct();

        // On `main` this fails (the read is never sent): Number of calls: 0.
        expect(mockOpenPolicyProfilePage).toHaveBeenCalledTimes(1);
        expect(mockOpenPolicyProfilePage).toHaveBeenCalledWith(POLICY_ID);
    });
});
