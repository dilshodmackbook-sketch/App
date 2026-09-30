import getBankAccountOwnerDetails, {hasCompleteUSAddress} from '@pages/EnablePayments/Wallet/utils/getBankAccountOwnerDetails';

import CONST from '@src/CONST';
import type {PrivatePersonalDetails} from '@src/types/onyx';

const US_PROFILE: PrivatePersonalDetails = {
    legalFirstName: 'Jane',
    legalLastName: 'Doe',
    addresses: [{street: '1 Main St\nApt 4', city: 'Austin', state: 'TX', zip: '78701', country: CONST.COUNTRY.US, current: true}],
};

describe('getBankAccountOwnerDetails', () => {
    it('sends the saved profile name and address when both wallet pages were skipped', () => {
        // Given a profile with a legal name and a complete US address, so the wallet skips both pages
        // When we build the owner details with no values entered in the flow
        const details = getBankAccountOwnerDetails(US_PROFILE, {});

        // Then AddPersonalBankAccount still gets the name and the address, with the unit kept
        expect(details).toEqual({
            legalFirstName: 'Jane',
            legalLastName: 'Doe',
            addressStreet: '1 Main St',
            addressStreet2: 'Apt 4',
            addressCity: 'Austin',
            addressState: 'TX',
            addressZipCode: '78701',
            country: CONST.COUNTRY.US,
        });
    });

    it('sends the values entered in the flow when the profile has none', () => {
        // Given an empty profile, so the user typed the name and address in the wallet pages
        const draft = {legalFirstName: 'John', legalLastName: 'Roe', addressStreet: '9 Oak Ave', addressCity: 'Boise', addressState: 'ID', addressZipCode: '83702'};

        // When we build the owner details
        const details = getBankAccountOwnerDetails({}, draft);

        // Then the entered values go out, pinned to the US since the wallet form is US only
        expect(details).toEqual({...draft, addressStreet2: undefined, country: CONST.COUNTRY.US});
    });

    it('does not mix a partial non-US profile address into the entered one', () => {
        // Given a profile with an incomplete UK address and a unit, and a US address typed in the flow
        const profile: PrivatePersonalDetails = {addresses: [{street: '10 High St', street2: 'Flat 2', city: 'London', country: 'GB', current: true}]};
        const draft = {addressStreet: '9 Oak Ave', addressCity: 'Boise', addressState: 'ID', addressZipCode: '83702'};

        // When we build the owner details
        const details = getBankAccountOwnerDetails(profile, draft);

        // Then only the typed address is sent, without the UK unit or country
        expect(details.addressStreet2).toBeUndefined();
        expect(details.country).toBe(CONST.COUNTRY.US);
        expect(details.addressCity).toBe('Boise');
    });

    it('lets an address edited from confirmation win over the saved one', () => {
        // Given a complete saved address that the user changed from the confirmation page
        const draft = {addressStreet: '5 Elm Rd', addressCity: 'Reno', addressState: 'NV', addressZipCode: '89501'};

        // When we build the owner details
        const details = getBankAccountOwnerDetails(US_PROFILE, draft);

        // Then the edited address is sent, not the saved one
        expect(details.addressStreet).toBe('5 Elm Rd');
        expect(details.addressStreet2).toBeUndefined();
        expect(details.addressCity).toBe('Reno');
    });
});

describe('hasCompleteUSAddress', () => {
    it('only treats a complete US address as on file', () => {
        // Given a complete US address and a complete UK one
        const uk: PrivatePersonalDetails = {addresses: [{street: '10 High St', city: 'London', zip: 'SW1A 1AA', country: 'GB', current: true}]};

        // When we check them / Then only the US one lets the wallet skip its US-only address page
        expect(hasCompleteUSAddress(US_PROFILE)).toBe(true);
        expect(hasCompleteUSAddress(uk)).toBe(false);
        expect(hasCompleteUSAddress({})).toBe(false);
    });
});
