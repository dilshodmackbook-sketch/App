import {render} from '@testing-library/react-native';

import DistanceRequestController from '@components/MoneyRequestConfirmationList/DistanceRequestController';

import DistanceRequestUtils from '@libs/DistanceRequestUtils';

import CONST from '@src/CONST';
import type {Policy, Transaction} from '@src/types/onyx';

import React from 'react';

import createMock from '../../../utils/createMock';

const mockSetMoneyRequestAmount = jest.fn();
const mockSetMoneyRequestCommuterExclusionFields = jest.fn();
const mockSetMoneyRequestMerchant = jest.fn();
const mockSetMoneyRequestPendingFields = jest.fn();
const mockSetCustomUnitRateID = jest.fn();

jest.mock('@hooks/useCurrencyList', () => ({
    useCurrencyListActions: () => ({
        getCurrencySymbol: (currency: string) => (currency === 'USD' ? '$' : undefined),
    }),
}));

jest.mock('@hooks/useLocalize', () => ({
    __esModule: true,
    default: () => ({
        translate: (key: string) => key,
        toLocaleDigit: (digit: string) => digit,
    }),
}));

jest.mock('@hooks/useOnyx', () => ({
    __esModule: true,
    default: () => [undefined],
}));

jest.mock('@hooks/usePrevious', () => ({
    __esModule: true,
    default: () => undefined,
}));

jest.mock('@libs/actions/IOU/MoneyRequest', () => ({
    clearMoneyRequestRateAutoUpdated: jest.fn(),
    setCustomUnitRateID: (...args: unknown[]) => {
        mockSetCustomUnitRateID(...args);
    },
    setMoneyRequestAmount: (...args: unknown[]) => {
        mockSetMoneyRequestAmount(...args);
    },
    setMoneyRequestCommuterExclusionFields: (...args: unknown[]) => {
        mockSetMoneyRequestCommuterExclusionFields(...args);
    },
    setMoneyRequestMerchant: (...args: unknown[]) => {
        mockSetMoneyRequestMerchant(...args);
    },
    setMoneyRequestPendingFields: (...args: unknown[]) => {
        mockSetMoneyRequestPendingFields(...args);
    },
}));

jest.mock('@libs/actions/IOU/Split', () => ({
    setSplitShares: jest.fn(),
}));

const transaction = createMock<Transaction>({
    transactionID: 'txn1',
    currency: CONST.CURRENCY.USD,
    comment: {customUnit: {}},
});

describe('DistanceRequestController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('updates the base distance merchant and delegates commuter fields to the commuter action', () => {
        render(
            <DistanceRequestController
                transactionID="txn1"
                transaction={transaction}
                policy={undefined}
                isDistanceRequest
                isManualDistanceRequest={false}
                isPolicyExpenseChat={false}
                isMovingTransactionFromTrackExpense={false}
                isReadOnly={false}
                isTypeSplit={false}
                customUnitRateID=""
                mileageRate={{rate: 67, unit: CONST.CUSTOM_UNITS.DISTANCE_UNIT_MILES, currency: CONST.CURRENCY.USD}}
                rate={67}
                unit={CONST.CUSTOM_UNITS.DISTANCE_UNIT_MILES}
                currency={CONST.CURRENCY.USD}
                distance={DistanceRequestUtils.convertToDistanceInMeters(4, CONST.CUSTOM_UNITS.DISTANCE_UNIT_MILES)}
                distanceRequestAmount={201}
                shouldCalculateDistanceAmount={false}
                currentUserAccountID={1}
                isDistanceRequestWithPendingRoute={false}
                hasRoute
                defaultMileageRateCustomUnitRateID={undefined}
                selectedParticipants={[]}
                selectedParticipantsProp={[]}
                setFormError={jest.fn()}
                clearFormErrors={jest.fn()}
            />,
        );

        expect(mockSetMoneyRequestMerchant).toHaveBeenCalledWith('txn1', '4.00 mi @ $0.67 / mi', true);
        expect(mockSetMoneyRequestCommuterExclusionFields).toHaveBeenCalledWith(
            expect.objectContaining({
                transactionID: 'txn1',
                transaction,
                policy: undefined,
                isPolicyExpenseChat: false,
                customUnitRateID: '',
                routeDistanceMeters: DistanceRequestUtils.convertToDistanceInMeters(4, CONST.CUSTOM_UNITS.DISTANCE_UNIT_MILES),
                distanceUnit: CONST.CUSTOM_UNITS.DISTANCE_UNIT_MILES,
            }),
        );
    });

    describe('moving a Self DM track-distance expense to a workspace', () => {
        // A policy whose default distance rate value/unit happens to equal the P2P/IRS default rate the
        // tracked expense carries. Both the active workspace and the destination look like this.
        const buildPolicyWithRate = (policyID: string, rateID: string) =>
            createMock<Policy>({
                id: policyID,
                customUnits: {
                    cu1: {
                        customUnitID: 'cu1',
                        name: CONST.CUSTOM_UNITS.NAME_DISTANCE,
                        attributes: {unit: CONST.CUSTOM_UNITS.DISTANCE_UNIT_MILES},
                        rates: {
                            [rateID]: {
                                customUnitRateID: rateID,
                                rate: 67,
                                currency: CONST.CURRENCY.USD,
                                name: 'Default Rate',
                                enabled: true,
                            },
                        },
                    },
                },
            });

        const sharedProps = {
            transactionID: 'txn1',
            transaction,
            isDistanceRequest: true as const,
            isManualDistanceRequest: false,
            isPolicyExpenseChat: true,
            isMovingTransactionFromTrackExpense: true,
            isReadOnly: false,
            isTypeSplit: false,
            // The tracked expense still carries the P2P sentinel rate.
            customUnitRateID: CONST.CUSTOM_UNITS.FAKE_P2P_ID,
            mileageRate: {rate: 67, unit: CONST.CUSTOM_UNITS.DISTANCE_UNIT_MILES, currency: CONST.CURRENCY.USD},
            rate: 67,
            unit: CONST.CUSTOM_UNITS.DISTANCE_UNIT_MILES,
            currency: CONST.CURRENCY.USD,
            distance: DistanceRequestUtils.convertToDistanceInMeters(4, CONST.CUSTOM_UNITS.DISTANCE_UNIT_MILES),
            distanceRequestAmount: 201,
            shouldCalculateDistanceAmount: false,
            currentUserAccountID: 1,
            isDistanceRequestWithPendingRoute: false,
            hasRoute: true,
            defaultMileageRateCustomUnitRateID: undefined,
            selectedParticipantsProp: [],
            setFormError: jest.fn(),
            clearFormErrors: jest.fn(),
        };

        it('does not write a rate ID from a non-destination policy while the report re-bind is still resolving', () => {
            // During the async report re-bind, `policy` transiently resolves to the ACTIVE workspace,
            // not the destination the user picked (which is what the selected participant points to).
            const activePolicy = buildPolicyWithRate('ACTIVE_POLICY', 'RATE_ON_ACTIVE_WS');
            render(
                <DistanceRequestController
                    {...sharedProps}
                    policy={activePolicy}
                    selectedParticipants={[{accountID: 2, policyID: 'DESTINATION_POLICY'}]}
                />,
            );

            // The effect must NOT auto-write the active workspace's rate ID onto the draft, because that
            // ID belongs to no destination the user chose and corrupts the draft (nulls defaultP2PRate).
            expect(mockSetCustomUnitRateID).not.toHaveBeenCalled();
        });

        it('auto-selects a matching rate once the resolved policy matches the destination participant', () => {
            // Once the re-bind lands, `policy` resolves to the destination and the selected participant
            // matches it — the effect is allowed to run and value-match the destination's own rate.
            const destinationPolicy = buildPolicyWithRate('DESTINATION_POLICY', 'RATE_ON_DESTINATION_WS');
            render(
                <DistanceRequestController
                    {...sharedProps}
                    policy={destinationPolicy}
                    selectedParticipants={[{accountID: 2, policyID: 'DESTINATION_POLICY'}]}
                />,
            );

            expect(mockSetCustomUnitRateID).toHaveBeenCalledWith('txn1', 'RATE_ON_DESTINATION_WS', transaction, destinationPolicy, false, undefined);
        });
    });
});
