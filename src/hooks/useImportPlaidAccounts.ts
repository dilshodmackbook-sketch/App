import {useCallback} from 'react';
import {getDomainNameForPolicy} from '@libs/PolicyUtils';
import {importPlaidAccounts} from '@userActions/Plaid';
import ONYXKEYS from '@src/ONYXKEYS';
import useOnyx from './useOnyx';

export default function useImportPlaidAccounts(policyID?: string, domainName?: string) {
    const [assignCard] = useOnyx(ONYXKEYS.ASSIGN_CARD);
    const [addNewCard] = useOnyx(ONYXKEYS.ADD_NEW_COMPANY_CARD);

    const plaidToken = addNewCard?.data?.publicToken ?? assignCard?.cardToAssign?.plaidAccessToken;
    const plaidFeed = addNewCard?.data?.plaidConnectedFeed ?? assignCard?.cardToAssign?.institutionId;
    const plaidFeedName = addNewCard?.data?.plaidConnectedFeedName ?? assignCard?.cardToAssign?.plaidConnectedFeedName;
    const plaidAccounts = addNewCard?.data?.plaidAccounts ?? assignCard?.cardToAssign?.plaidAccounts;
    const country = addNewCard?.data?.selectedCountry;

    return useCallback(() => {
        if (!policyID || !plaidToken || !plaidFeed || !plaidFeedName || !country || !plaidAccounts?.length) {
            return;
        }
        // Scope the Plaid reconnect to the feed's owning domain when reauthorizing a shared feed; fall back to the policy domain.
        importPlaidAccounts(plaidToken, plaidFeed, plaidFeedName, country, domainName ?? getDomainNameForPolicy(policyID), JSON.stringify(plaidAccounts), '');
    }, [country, plaidAccounts, plaidFeed, plaidFeedName, plaidToken, policyID, domainName]);
}
