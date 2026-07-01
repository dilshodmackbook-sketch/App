import {getCompanyCardBankConnection} from '@libs/actions/getCompanyCardBankConnection';
import {getFeedDomainName} from '@libs/CardUtils';
import CONST from '@src/CONST';
import type {WorkspaceCardsList} from '@src/types/onyx';

jest.mock('@libs/Network/NetworkStore', () => ({
    getAuthToken: jest.fn(() => 'test-auth-token'),
}));

const POLICY_ID = '17F617B9FE23D2F1';
const BANK_NAME = CONST.COMPANY_CARDS.BANKS.CHASE;

function getDomainNameFromUrl(url: string | null): string | null {
    if (!url) {
        return null;
    }
    const query = url.split('?').at(1) ?? '';
    return new URLSearchParams(query).get('domainName');
}

describe('getCompanyCardBankConnection', () => {
    it('returns null when no bankName is provided', () => {
        expect(getCompanyCardBankConnection(POLICY_ID, undefined)).toBeNull();
    });

    it('returns null when no policyID is provided', () => {
        expect(getCompanyCardBankConnection(undefined, BANK_NAME)).toBeNull();
    });

    it('falls back to the synthetic policy domain when no domainName override is passed', () => {
        const url = getCompanyCardBankConnection(POLICY_ID, BANK_NAME);
        expect(getDomainNameFromUrl(url)).toBe(`expensify-policy${POLICY_ID.toLowerCase()}.exfy`);
    });

    it('uses the passed feed-owner domainName override instead of the current policy domain', () => {
        const url = getCompanyCardBankConnection(POLICY_ID, BANK_NAME, 'company.com');
        expect(getDomainNameFromUrl(url)).toBe('company.com');
    });

    // Reproduces the shared-feed reauthorization bug from #95069 at the data layer: assigning a card from a child
    // workspace whose feed is owned by another domain, and hitting the broken-connection reauth prompt.
    describe('shared feed reauthorization scenario (#95069)', () => {
        const CHILD_POLICY_ID = '20FF888888888888';

        it('BEFORE the fix: reauth from the child workspace targets the child synthetic domain (broken connection is never refreshed)', () => {
            const url = getCompanyCardBankConnection(CHILD_POLICY_ID, BANK_NAME);
            // This is the child workspace's own domain, not the feed owner's — so the owning connection stays broken.
            expect(getDomainNameFromUrl(url)).toBe(`expensify-policy${CHILD_POLICY_ID.toLowerCase()}.exfy`);
        });

        it('AFTER the fix: reauth resolves the owner domain from the feed cards and targets it', () => {
            // The feed is owned by a real company domain and its cards carry that owner domainName.
            const ownerFeedCards: WorkspaceCardsList = {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                '31570652': {
                    accountID: 18439984,
                    bank: CONST.COMPANY_CARD.FEED_BANK_NAME.CHASE,
                    cardID: 31570652,
                    cardName: 'CREDIT CARD...9901',
                    domainName: 'company.com',
                    fraud: 'none',
                    lastFourPAN: '9901',
                    lastScrape: '',
                    lastUpdated: '',
                    lastScrapeResult: 403,
                    scrapeMinDate: '2024-08-27',
                    state: 3,
                },
            };

            const feedDomainName = getFeedDomainName(ownerFeedCards);
            const url = getCompanyCardBankConnection(CHILD_POLICY_ID, BANK_NAME, feedDomainName);

            expect(feedDomainName).toBe('company.com');
            expect(getDomainNameFromUrl(url)).toBe('company.com');
            expect(getDomainNameFromUrl(url)).not.toBe(`expensify-policy${CHILD_POLICY_ID.toLowerCase()}.exfy`);
        });
    });
});
