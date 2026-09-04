import {render, screen} from '@testing-library/react-native';

import IncorporationCode from '@pages/ReimbursementAccount/USD/BusinessInfo/subSteps/IncorporationCode';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';

import type * as ReactNavigation from '@react-navigation/native';

import React from 'react';
import Onyx from 'react-native-onyx';

import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

/**
 * Reproduces #99755: on "Update details" the Industry classification code opens blank,
 * while every other Business info field is prefilled from achData.
 *
 * The sub page passes the resolved default straight to IndustryCodeSelector's `value` prop,
 * so we mock the selector to surface that value and assert the prefill decision directly.
 */
const INDUSTRY_CODE = '541511';

jest.mock('@pages/ReimbursementAccount/USD/BusinessInfo/subSteps/IndustryCode/IndustryCodeSelector', () => {
    const {Text} = jest.requireActual<{Text: React.ComponentType<{testID?: string; children?: React.ReactNode}>}>('react-native');
    // eslint-disable-next-line react/function-component-definition
    const MockIndustryCodeSelector = ({value}: {value?: string}) => <Text testID="industry-code-value">{value ?? ''}</Text>;
    return MockIndustryCodeSelector;
});

jest.mock('@react-navigation/native', () => {
    const actualNavigation = jest.requireActual<typeof ReactNavigation>('@react-navigation/native');
    return {
        ...actualNavigation,
        useIsFocused: () => true,
        useFocusEffect: jest.fn(),
        useNavigation: () => ({addListener: jest.fn(() => jest.fn()), dispatch: jest.fn(), setParams: jest.fn(), isFocused: () => true}),
        useRoute: () => ({params: {}}),
    };
});

jest.mock('@hooks/useLocalize', () => ({
    __esModule: true,
    default: () => ({translate: (key: string) => key, numberFormat: (value: number) => String(value)}),
}));

function renderSubStep(isEditing = false) {
    return render(
        <IncorporationCode
            onNext={jest.fn()}
            isEditing={isEditing}
        />,
    );
}

async function seedAccount(state: string) {
    await Onyx.set(ONYXKEYS.REIMBURSEMENT_ACCOUNT, {
        achData: {
            state,
            industryCode: INDUSTRY_CODE,
        },
    });
}

describe('IncorporationCode prefill (#99755)', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        await Onyx.clear();
    });

    it('prefills the saved code on the Update details walkthrough (verifying account, isEditing=false)', async () => {
        // The reported flow: account is VERIFYING, user walks forward with Next so isEditing is false.
        await seedAccount(CONST.BANK_ACCOUNT.STATE.VERIFYING);

        renderSubStep(false);
        await waitForBatchedUpdatesWithAct();

        // RED on main (renders ''), GREEN with the fix.
        expect(screen.getByTestId('industry-code-value')).toHaveTextContent(INDUSTRY_CODE);
    });

    it('keeps the field blank during a fresh setup so #88504 stays fixed (setup account, isEditing=false)', async () => {
        // On SETUP the backend can seed industryCode with a value the user never chose (#88504), so it must not prefill.
        await seedAccount(CONST.BANK_ACCOUNT.STATE.SETUP);

        renderSubStep(false);
        await waitForBatchedUpdatesWithAct();

        expect(screen.getByTestId('industry-code-value')).toHaveTextContent('');
    });

    it('prefills when editing a single field from the confirmation page (isEditing=true)', async () => {
        // The pre-existing edit path must stay unchanged.
        await seedAccount(CONST.BANK_ACCOUNT.STATE.SETUP);

        renderSubStep(true);
        await waitForBatchedUpdatesWithAct();

        expect(screen.getByTestId('industry-code-value')).toHaveTextContent(INDUSTRY_CODE);
    });
});
