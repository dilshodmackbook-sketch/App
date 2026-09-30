import {getCurrentAddress, getStreetLines, hasCompleteAddress} from '@libs/PersonalDetailsUtils';

import CONST from '@src/CONST';
import type {PersonalBankAccountForm} from '@src/types/form';
import type {PrivatePersonalDetails} from '@src/types/onyx';

import type {OnyxEntry} from 'react-native-onyx';

type BankAccountOwnerDetails = {
    legalFirstName?: string;
    legalLastName?: string;
    addressStreet?: string;
    addressStreet2?: string;
    addressCity?: string;
    addressState?: string;
    addressZipCode?: string;
    country?: string;
};

/**
 * Whether the profile has a complete US address, the only kind the US-only wallet flow can use
 */
function hasCompleteUSAddress(privatePersonalDetails: OnyxEntry<PrivatePersonalDetails>): boolean {
    return hasCompleteAddress(privatePersonalDetails) && getCurrentAddress(privatePersonalDetails)?.country === CONST.COUNTRY.US;
}

/**
 * Resolves the owner name and address sent with AddPersonalBankAccount from the wallet flow.
 * Values entered in the flow win, the saved profile covers the pages we skipped.
 */
function getBankAccountOwnerDetails(privatePersonalDetails: OnyxEntry<PrivatePersonalDetails>, draft: OnyxEntry<Partial<PersonalBankAccountForm>>): BankAccountOwnerDetails {
    const name = {
        legalFirstName: draft?.legalFirstName ?? privatePersonalDetails?.legalFirstName,
        legalLastName: draft?.legalLastName ?? privatePersonalDetails?.legalLastName,
    };

    // The wallet address page is US only, so an entered address never takes the country or unit of the profile one
    if (draft?.addressStreet || !hasCompleteUSAddress(privatePersonalDetails)) {
        return {
            ...name,
            addressStreet: draft?.addressStreet,
            addressStreet2: draft?.addressStreet2,
            addressCity: draft?.addressCity,
            addressState: draft?.addressState,
            addressZipCode: draft?.addressZipCode,
            country: CONST.COUNTRY.US,
        };
    }

    const currentAddress = getCurrentAddress(privatePersonalDetails);
    const [addressStreet, street2] = getStreetLines(currentAddress?.street);
    return {
        ...name,
        addressStreet,
        addressStreet2: street2 ?? currentAddress?.street2 ?? currentAddress?.addressLine2,
        addressCity: currentAddress?.city,
        addressState: currentAddress?.state,
        addressZipCode: currentAddress?.zip,
        country: CONST.COUNTRY.US,
    };
}

export default getBankAccountOwnerDetails;
export {hasCompleteUSAddress};
export type {BankAccountOwnerDetails};
