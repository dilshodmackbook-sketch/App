import {toggleContinuousReconciliation} from '@libs/actions/Card';
import * as API from '@libs/API';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';

/**
 * Regression test for https://github.com/Expensify/App/issues/97215
 *
 * `toggleContinuousReconciliation` addresses two different identities:
 *  - the request field `policyAccountID`, which the `TOGGLE_CARD_CONTINUOUS_RECONCILIATION` command
 *    expects to be the workspace's `policy.policyAccountID`; and
 *  - the domain-scoped fund ID that the reconciliation Onyx keys are stored under.
 *
 * On domain-linked card feeds those two are different numbers. Before the fix a single value served
 * both, so the request went out with a domain fund ID instead of `policy.policyAccountID`, the
 * command failed to persist, and `failureData` flipped the toggle back off. This asserts the request
 * carries the policy account ID while every Onyx update stays on the domain-fund-scoped keys.
 */
describe('toggleContinuousReconciliation (issue #97215)', () => {
    let spyAPIWrite: jest.SpyInstance;

    // policy.policyAccountID — the identifier the command's request field is named for.
    const POLICY_ACCOUNT_ID = 11111111;
    // The domain fund ID the reconciliation state is stored under (differs on domain-linked feeds).
    const DOMAIN_FUND_ID = 99999999;
    const connectionName = CONST.POLICY.CONNECTIONS.NAME.QBO;
    const oldConnectionName = CONST.POLICY.CONNECTIONS.NAME.XERO;

    beforeEach(() => {
        spyAPIWrite = jest.spyOn(API, 'write').mockImplementation(() => Promise.resolve());
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('sends policyAccountID in the request while keying every Onyx update off the domain fund ID', () => {
        toggleContinuousReconciliation(POLICY_ACCOUNT_ID, DOMAIN_FUND_ID, true, connectionName, oldConnectionName);

        expect(spyAPIWrite).toHaveBeenCalledWith(
            'ToggleCardContinuousReconciliation',
            {
                policyAccountID: POLICY_ACCOUNT_ID,
                shouldUseContinuousReconciliation: true,
                expensifyCardContinuousReconciliationConnection: connectionName,
            },
            expect.objectContaining({
                optimisticData: expect.arrayContaining([
                    expect.objectContaining({
                        key: `${ONYXKEYS.COLLECTION.EXPENSIFY_CARD_USE_CONTINUOUS_RECONCILIATION}${DOMAIN_FUND_ID}`,
                        value: true,
                    }),
                    expect.objectContaining({
                        key: `${ONYXKEYS.COLLECTION.EXPENSIFY_CARD_USE_CONTINUOUS_RECONCILIATION_PENDING_ACTION}${DOMAIN_FUND_ID}`,
                        value: CONST.RED_BRICK_ROAD_PENDING_ACTION.UPDATE,
                    }),
                    expect.objectContaining({
                        key: `${ONYXKEYS.COLLECTION.EXPENSIFY_CARD_CONTINUOUS_RECONCILIATION_CONNECTION}${DOMAIN_FUND_ID}`,
                        value: connectionName,
                    }),
                ]),
                failureData: expect.arrayContaining([
                    expect.objectContaining({
                        key: `${ONYXKEYS.COLLECTION.EXPENSIFY_CARD_USE_CONTINUOUS_RECONCILIATION}${DOMAIN_FUND_ID}`,
                        value: false,
                    }),
                    expect.objectContaining({
                        key: `${ONYXKEYS.COLLECTION.EXPENSIFY_CARD_CONTINUOUS_RECONCILIATION_CONNECTION}${DOMAIN_FUND_ID}`,
                        value: oldConnectionName,
                    }),
                ]),
            }),
        );

        // The request identifier must be the policy account ID, never the domain fund ID.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrow the params captured from the mocked API.write
        const [, requestParams] = spyAPIWrite.mock.calls.at(0) as [string, {policyAccountID: number}];
        expect(requestParams.policyAccountID).not.toBe(DOMAIN_FUND_ID);
    });
});
