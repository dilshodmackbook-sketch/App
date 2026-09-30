import getSkippedPagesForPersonalInfo from '@pages/EnablePayments/Wallet/utils/getSkippedPagesForPersonalInfo';

import CONST from '@src/CONST';

const PAGES = CONST.ENABLE_PAYMENTS.PERSONAL_INFO_STEP.SUB_PAGE_NAMES;

describe('getSkippedPagesForPersonalInfo', () => {
    it('skips the name and address pages when the bank step already collected them', () => {
        // Given the name and address the Add bank account step handed over, but no DOB yet
        const values = {legalFirstName: 'Jane', legalLastName: 'Doe', addressStreet: '1 Main St', addressCity: 'Austin', addressState: 'TX', addressZipCode: '78701', dob: ''};

        // When KYC decides which pages to show
        const skipped = getSkippedPagesForPersonalInfo(values);

        // Then it doesn't ask for the name or address again, only the rest
        expect(skipped).toEqual([PAGES.LEGAL_NAME, PAGES.ADDRESS]);
    });

    it('keeps a page when any of its fields is missing', () => {
        // Given a full name but an address without a zip
        const values = {legalFirstName: 'Jane', legalLastName: 'Doe', addressStreet: '1 Main St', addressCity: 'Austin', addressState: 'TX', addressZipCode: ''};

        // When KYC decides which pages to show
        const skipped = getSkippedPagesForPersonalInfo(values);

        // Then the address page is still asked
        expect(skipped).toEqual([PAGES.LEGAL_NAME]);
    });

    it('skips nothing for a new user', () => {
        // Given no personal info at all
        // When KYC decides which pages to show / Then every page is shown
        expect(getSkippedPagesForPersonalInfo({})).toEqual([]);
    });
});
