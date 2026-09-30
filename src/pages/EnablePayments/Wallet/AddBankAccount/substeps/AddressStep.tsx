import CommonAddressStep from '@components/SubStepForms/AddressStep';

import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import usePersonalBankAccountDetailsFormSubmit from '@hooks/usePersonalBankAccountDetailsFormSubmit';
import type {SubPageProps} from '@hooks/useSubPage/types';

import {getCurrentAddress} from '@libs/PersonalDetailsUtils';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import INPUT_IDS from '@src/types/form/PersonalBankAccountForm';

import React from 'react';

const BANK_INFO_STEP_KEY = INPUT_IDS.BANK_INFO_STEP;

const INPUT_KEYS = {
    street: BANK_INFO_STEP_KEY.STREET,
    city: BANK_INFO_STEP_KEY.CITY,
    state: BANK_INFO_STEP_KEY.STATE,
    zipCode: BANK_INFO_STEP_KEY.ZIP_CODE,
    country: BANK_INFO_STEP_KEY.COUNTRY,
};

const STEP_FIELDS = [BANK_INFO_STEP_KEY.STREET, BANK_INFO_STEP_KEY.CITY, BANK_INFO_STEP_KEY.STATE, BANK_INFO_STEP_KEY.ZIP_CODE];

// US-only form like wallet KYC, the standalone AddressStep's country picker has no route here
function AddressStep({onNext, onMove, isEditing}: SubPageProps) {
    const {translate} = useLocalize();

    const [personalBankAccountDraft] = useOnyx(ONYXKEYS.FORMS.PERSONAL_BANK_ACCOUNT_FORM_DRAFT);
    const [privatePersonalDetails] = useOnyx(ONYXKEYS.PRIVATE_PERSONAL_DETAILS);

    // Only prefill a profile address this US-only form can hold
    const savedAddress = getCurrentAddress(privatePersonalDetails);
    const currentAddress = !savedAddress?.country || savedAddress.country === CONST.COUNTRY.US ? savedAddress : undefined;
    const defaultValues = {
        street: personalBankAccountDraft?.[BANK_INFO_STEP_KEY.STREET] ?? currentAddress?.street ?? '',
        city: personalBankAccountDraft?.[BANK_INFO_STEP_KEY.CITY] ?? currentAddress?.city ?? '',
        state: personalBankAccountDraft?.[BANK_INFO_STEP_KEY.STATE] ?? currentAddress?.state ?? '',
        zipCode: personalBankAccountDraft?.[BANK_INFO_STEP_KEY.ZIP_CODE] ?? currentAddress?.zip ?? '',
        country: CONST.COUNTRY.US,
    };

    const handleSubmit = usePersonalBankAccountDetailsFormSubmit({
        fieldIds: STEP_FIELDS,
        onNext,
        shouldSaveDraft: isEditing,
    });

    return (
        <CommonAddressStep<typeof ONYXKEYS.FORMS.PERSONAL_BANK_ACCOUNT_FORM>
            isEditing={isEditing}
            onNext={onNext}
            onMove={onMove}
            formID={ONYXKEYS.FORMS.PERSONAL_BANK_ACCOUNT_FORM}
            formTitle={translate('personalInfoStep.whatsYourAddress')}
            formPOBoxDisclaimer={translate('personalInfoStep.addressSubtitle')}
            onSubmit={handleSubmit}
            stepFields={STEP_FIELDS}
            inputFieldsIDs={INPUT_KEYS}
            defaultValues={defaultValues}
            shouldAllowCountryChange={false}
        />
    );
}

AddressStep.displayName = 'AddressStep';

export default AddressStep;
