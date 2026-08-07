import {act, render} from '@testing-library/react-native';

import SelectionList from '@components/SelectionList';

import DynamicReconciliationAccountSettingsPage from '@pages/workspace/accounting/reconciliation/DynamicReconciliationAccountSettingsPage';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Policy} from '@src/types/onyx';

import type {PropsWithChildren} from 'react';

import React from 'react';
import Onyx from 'react-native-onyx';

import waitForBatchedUpdates from '../utils/waitForBatchedUpdates';

/**
 * Regression test for https://github.com/Expensify/App/issues/97215
 *
 * The reconciliation flow is domain-scoped: the toggle page and the account picker must both
 * address the SAME Expensify Card feed. On customer accounts whose cards come from a company
 * domain, the feed's fund ID differs from `policy.policyAccountID`. Before the fix, the picker
 * (`ExpensifyCardDynamicReconciliation`) read and wrote the reconciliation account under
 * `policy.policyAccountID`, while the rest of the flow resolves the feed via `useDefaultFundID`.
 * The two disagree only on domain-feed accounts, which is why QA (single workspace feed) could
 * never reproduce it.
 *
 * These two IDs are deliberately made to diverge here (workspace account ID vs. domain fund ID)
 * so the test fails on `main` and passes once both the read and the write are keyed off
 * `useDefaultFundID`.
 */

const POLICY_ID = 'policy-1';
// policy.policyAccountID — the ID the picker used before the fix.
const WORKSPACE_ACCOUNT_ID = 11111111;
// The feed useDefaultFundID resolves to for a domain-linked card program (≠ workspace account ID).
const DOMAIN_FUND_ID = 99999999;

const EXISTING_ACCOUNT_ID = 'existing-qbo-account';
const NEW_ACCOUNT_ID = 'new-qbo-account';

// The picker resolves its feed through this hook; pin it to the domain fund ID so the divergence
// with WORKSPACE_ACCOUNT_ID is deterministic and independent of the card-settings topology.
jest.mock('@hooks/useDefaultFundID', () => jest.fn(() => DOMAIN_FUND_ID));

const mockSetCardReconciliationAccount = jest.fn();
jest.mock('@userActions/Card', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const actual = jest.requireActual('@userActions/Card');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return {
        ...actual,
        setCardReconciliationAccount: (...args: unknown[]): void => {
            mockSetCardReconciliationAccount(...args);
        },
    };
});

jest.mock('@libs/PolicyUtils', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const actual = jest.requireActual('@libs/PolicyUtils');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return {
        ...actual,
        getDomainNameForPolicy: jest.fn(() => 'customer.example.com'),
    };
});

jest.mock('@libs/Navigation/Navigation', () => ({
    goBack: jest.fn(),
    getActiveRoute: jest.fn(() => ''),
}));

jest.mock('@components/SelectionList', () => jest.fn(() => null));
jest.mock('@components/SelectionList/ListItem/SingleSelectListItem', () => jest.fn(() => null));
jest.mock('@components/ConnectionLayout', () => jest.fn(({children}: PropsWithChildren) => children));
jest.mock('@components/RenderHTML', () => jest.fn(() => null));
jest.mock('@components/Text', () => jest.fn(() => null));

jest.mock('@hooks/useDynamicBackPath', () => jest.fn(() => ''));
jest.mock('@hooks/useEnvironment', () => jest.fn(() => ({environmentURL: ''})));
jest.mock('@hooks/useThemeStyles', () => jest.fn(() => new Proxy({}, {get: () => ({})})));
jest.mock('@hooks/useLocalize', () =>
    jest.fn(() => ({
        translate: (key: string) => key,
        localeCompare: (a: string, b: string) => a.localeCompare(b),
    })),
);

type MockOption = {value: string; keyForList: string; isSelected: boolean};
type MockSelectionListProps = {
    data: MockOption[];
    onSelectRow?: (item: {value: string}) => void;
    initiallyFocusedItemKey?: string;
    confirmButtonOptions?: {onConfirm?: () => void};
};

function renderPage() {
    const params = {policyID: POLICY_ID, connection: CONST.POLICY.CONNECTIONS.ROUTE.QBO, reconciliationAccountSettingsType: 'expensifyCard'};
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test-only route stub; the page only reads route.params
    const props = {route: {params}} as React.ComponentProps<typeof DynamicReconciliationAccountSettingsPage>;
    return render(<DynamicReconciliationAccountSettingsPage {...props} />);
}

describe('DynamicReconciliationAccountSettingsPage (domain-feed reconciliation)', () => {
    const mockedSelectionList = jest.mocked(SelectionList);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrow the props captured from the mocked SelectionList
    const getSelectionListProps = () => mockedSelectionList.mock.lastCall?.[0] as MockSelectionListProps | undefined;

    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        await Onyx.clear();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test-only minimal Policy stub
        const policy = {id: POLICY_ID, policyAccountID: WORKSPACE_ACCOUNT_ID} as Policy;
        await Onyx.set(`${ONYXKEYS.COLLECTION.POLICY}${POLICY_ID}`, policy);
        // Server stored the reconciliation account under the domain feed; the workspace-account key is empty.
        await Onyx.set(`${ONYXKEYS.COLLECTION.EXPENSIFY_CARD_RECONCILIATION_BANK_ACCOUNT_ID}${DOMAIN_FUND_ID}`, EXISTING_ACCOUNT_ID);
        await waitForBatchedUpdates();
    });

    afterEach(async () => {
        await Onyx.clear();
        await waitForBatchedUpdates();
    });

    it('reads the previously saved reconciliation account from the domain feed, not the workspace account', async () => {
        renderPage();
        await waitForBatchedUpdates();

        // On main the page reads `expensifyCard_bankAccount_${policyAccountID}` (empty) and this is undefined.
        expect(getSelectionListProps()?.initiallyFocusedItemKey).toBe(EXISTING_ACCOUNT_ID);
    });

    it('saves the selected reconciliation account under the domain feed the toggle targets', async () => {
        renderPage();
        await waitForBatchedUpdates();

        act(() => {
            getSelectionListProps()?.onSelectRow?.({value: NEW_ACCOUNT_ID});
        });
        await waitForBatchedUpdates();

        act(() => {
            getSelectionListProps()?.confirmButtonOptions?.onConfirm?.();
        });
        await waitForBatchedUpdates();

        // On main the first argument is WORKSPACE_ACCOUNT_ID, so the account lands on a feed the toggle never targeted.
        expect(mockSetCardReconciliationAccount).toHaveBeenCalledWith(DOMAIN_FUND_ID, expect.any(String), NEW_ACCOUNT_ID, EXISTING_ACCOUNT_ID);
    });
});
