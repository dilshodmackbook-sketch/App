import FormProvider from '@components/Form/FormProvider';
import InputWrapper from '@components/Form/InputWrapper';
import type {FormInputErrors, FormOnyxValues} from '@components/Form/types';
import Text from '@components/Text';

import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import useReimbursementAccountStepFormSubmit from '@hooks/useReimbursementAccountStepFormSubmit';
import type {SubPageProps} from '@hooks/useSubPage/types';
import useThemeStyles from '@hooks/useThemeStyles';

import {isValidIndustryCode} from '@libs/ValidationUtils';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import INPUT_IDS from '@src/types/form/ReimbursementAccountForm';

import React from 'react';

import IndustryCodeSelector from './IndustryCode/IndustryCodeSelector';

const COMPANY_INCORPORATION_CODE_KEY = INPUT_IDS.BUSINESS_INFO_STEP.INCORPORATION_CODE;
const STEP_FIELDS = [COMPANY_INCORPORATION_CODE_KEY];

function IncorporationCode({onNext, isEditing}: SubPageProps) {
    const {translate} = useLocalize();
    const styles = useThemeStyles();
    const [reimbursementAccount] = useOnyx(ONYXKEYS.REIMBURSEMENT_ACCOUNT);

    // "Update details" re-walks the Business info sub-steps without action=edit, so isEditing is false here.
    // A verifying account has already submitted the company step, so achData.industryCode is a value the user confirmed and should be prefilled.
    // A SETUP account may still carry a backend seed, so it stays blank there and #88504 remains fixed. This mirrors how BusinessInfo restarts the step for a verifying account.
    const isBankAccountVerifying = reimbursementAccount?.achData?.state === CONST.BANK_ACCOUNT.STATE.VERIFYING;

    const handleSubmit = useReimbursementAccountStepFormSubmit({
        fieldIds: STEP_FIELDS,
        onNext,
        shouldSaveDraft: isEditing,
    });

    const validate = (values: FormOnyxValues<typeof ONYXKEYS.FORMS.REIMBURSEMENT_ACCOUNT_FORM>): FormInputErrors<typeof ONYXKEYS.FORMS.REIMBURSEMENT_ACCOUNT_FORM> => {
        const errors: FormInputErrors<typeof ONYXKEYS.FORMS.REIMBURSEMENT_ACCOUNT_FORM> = {};

        if (!values[COMPANY_INCORPORATION_CODE_KEY]) {
            errors[COMPANY_INCORPORATION_CODE_KEY] = translate('common.error.fieldRequired');
        } else if (!isValidIndustryCode(values[COMPANY_INCORPORATION_CODE_KEY])) {
            errors[COMPANY_INCORPORATION_CODE_KEY] = translate('bankAccount.error.industryCode');
        }

        return errors;
    };

    return (
        <FormProvider
            formID={ONYXKEYS.FORMS.REIMBURSEMENT_ACCOUNT_FORM}
            submitButtonText={translate(isEditing ? 'common.confirm' : 'common.next')}
            validate={validate}
            onSubmit={handleSubmit}
            style={[styles.mh0, styles.flexGrow1]}
            submitButtonStyles={[styles.ph5, styles.mb0]}
            shouldHideFixErrorsAlert
        >
            <Text style={[styles.textHeadlineLineHeightXXL, styles.ph5, styles.mb6]}>{translate('companyStep.industryClassification')}</Text>
            <InputWrapper
                InputComponent={IndustryCodeSelector}
                inputID={COMPANY_INCORPORATION_CODE_KEY}
                shouldSaveDraft={!isEditing}
                defaultValue={isEditing || isBankAccountVerifying ? reimbursementAccount?.achData?.industryCode : ''}
            />
        </FormProvider>
    );
}

export default IncorporationCode;
