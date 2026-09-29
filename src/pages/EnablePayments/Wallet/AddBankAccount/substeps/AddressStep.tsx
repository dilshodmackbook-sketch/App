import CommonAddressStep from '@components/SubStepForms/AddressStep';

import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import usePersonalBankAccountDetailsFormSubmit from '@hooks/usePersonalBankAccountDetailsFormSubmit';
import type {SubPageProps} from '@hooks/useSubPage/types';

import {getCurrentAddress} from '@libs/PersonalDetailsUtils';

import ONYXKEYS from '@src/ONYXKEYS';
import INPUT_IDS from '@src/types/form/PersonalBankAccountForm';

import React, {useMemo} from 'react';

const BANK_INFO_STEP_KEY = INPUT_IDS.BANK_INFO_STEP;

const INPUT_KEYS = {
    street: BANK_INFO_STEP_KEY.STREET,
    city: BANK_INFO_STEP_KEY.CITY,
    state: BANK_INFO_STEP_KEY.STATE,
    zipCode: BANK_INFO_STEP_KEY.ZIP_CODE,
};

const STEP_FIELDS = [BANK_INFO_STEP_KEY.STREET, BANK_INFO_STEP_KEY.CITY, BANK_INFO_STEP_KEY.STATE, BANK_INFO_STEP_KEY.ZIP_CODE];

// The wallet Add bank account route has no `country` sub-route, so this reuses the shared US-only address
// form (state picker, country locked to US) instead of the standalone AddressStep's country-selector form.
function AddressStep({onNext, onMove, isEditing}: SubPageProps) {
    const {translate} = useLocalize();

    const [personalBankAccountDraft] = useOnyx(ONYXKEYS.FORMS.PERSONAL_BANK_ACCOUNT_FORM_DRAFT);
    const [privatePersonalDetails] = useOnyx(ONYXKEYS.PRIVATE_PERSONAL_DETAILS);

    const defaultValues = useMemo(() => {
        const currentAddress = getCurrentAddress(privatePersonalDetails);
        return {
            street: personalBankAccountDraft?.[BANK_INFO_STEP_KEY.STREET] ?? currentAddress?.street ?? '',
            city: personalBankAccountDraft?.[BANK_INFO_STEP_KEY.CITY] ?? currentAddress?.city ?? '',
            state: personalBankAccountDraft?.[BANK_INFO_STEP_KEY.STATE] ?? currentAddress?.state ?? '',
            zipCode: personalBankAccountDraft?.[BANK_INFO_STEP_KEY.ZIP_CODE] ?? currentAddress?.zip ?? '',
        };
    }, [personalBankAccountDraft, privatePersonalDetails]);

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
