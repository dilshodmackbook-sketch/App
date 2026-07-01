import {getApiRoot} from '@libs/ApiUtils';
import * as NetworkStore from '@libs/Network/NetworkStore';
import * as PolicyUtils from '@libs/PolicyUtils';
import CONST from '@src/CONST';

type CompanyCardBankConnection = {
    authToken: string;
    domainName: string;
    scrapeMinDate: string;
    isCorporate: string;
    isNewDot: string;
};

type PersonalCardBankConnection = {
    authToken: string;
    isNewDot: string;
    scrapeMinDate: string;
};

function getCompanyCardBankConnection(policyID?: string, bankName?: string | null, domainName?: string) {
    const bankConnection = Object.keys(CONST.COMPANY_CARDS.BANKS).find((key) => CONST.COMPANY_CARDS.BANKS[key as keyof typeof CONST.COMPANY_CARDS.BANKS] === bankName);

    if (!bankName || !bankConnection || !policyID) {
        return null;
    }
    const authToken = NetworkStore.getAuthToken();
    const params: CompanyCardBankConnection = {
        authToken: authToken ?? '',
        isNewDot: 'true',
        // Reauthorization must target the feed's owning domain. Shared feeds are owned by a different domain, so
        // fall back to the current policy's synthetic domain only when no feed domain is provided.
        domainName: domainName ?? PolicyUtils.getDomainNameForPolicy(policyID),
        isCorporate: 'true',
        scrapeMinDate: '',
    };
    const bank = CONST.COMPANY_CARDS.BANK_CONNECTIONS[bankConnection as keyof typeof CONST.COMPANY_CARDS.BANK_CONNECTIONS];

    // The Amex connection whitelists only our production servers, so we need to always use the production API for American Express
    const forceProductionAPI = bank === CONST.COMPANY_CARDS.BANK_CONNECTIONS.AMEX;
    const commandURL = getApiRoot(
        {
            shouldSkipWebProxy: true,
        },
        forceProductionAPI,
    );
    return `${commandURL}partners/banks/${bank}/oauth_callback.php?${new URLSearchParams(params).toString()}`;
}

function getPersonalCardBankConnection(bankName?: string | null) {
    const bankConnection = Object.keys(CONST.PERSONAL_CARDS.BANKS).find((key) => CONST.PERSONAL_CARDS.BANKS[key as keyof typeof CONST.PERSONAL_CARDS.BANKS] === bankName);

    if (!bankName || !bankConnection) {
        return null;
    }
    const authToken = NetworkStore.getAuthToken();
    const params: PersonalCardBankConnection = {
        authToken: authToken ?? '',
        isNewDot: 'true',
        scrapeMinDate: '',
    };
    const bank = CONST.PERSONAL_CARDS.BANK_CONNECTIONS[bankConnection as keyof typeof CONST.PERSONAL_CARDS.BANK_CONNECTIONS];

    // The Amex connection whitelists only our production servers, so we need to always use the production API for American Express
    const forceProductionAPI = bank === CONST.PERSONAL_CARDS.BANK_CONNECTIONS.AMEX;
    const commandURL = getApiRoot(
        {
            shouldSkipWebProxy: true,
            command: '',
        },
        forceProductionAPI,
    );
    return `${commandURL}partners/banks/${bank}/oauth_callback.php?${new URLSearchParams(params).toString()}`;
}

export {getCompanyCardBankConnection, getPersonalCardBankConnection};
