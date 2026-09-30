import CONST from '@src/CONST';
import type {EnablePaymentsSubPageType} from '@src/CONST';
import INPUT_IDS from '@src/types/form/WalletAdditionalDetailsForm';
import type {PersonalInfoStepProps} from '@src/types/form/WalletAdditionalDetailsForm';

const personalInfoKeys = INPUT_IDS.PERSONAL_INFO_STEP;
const PERSONAL_INFO_SUB_PAGES = CONST.ENABLE_PAYMENTS.PERSONAL_INFO_STEP.SUB_PAGE_NAMES;

/**
 * Returns the Personal Info pages whose data we already have, e.g. the name and address entered when adding the bank account
 */
function getSkippedPagesForPersonalInfo(data: Partial<PersonalInfoStepProps>): EnablePaymentsSubPageType[] {
    const skippedPages: EnablePaymentsSubPageType[] = [];
    if (!!data[personalInfoKeys.FIRST_NAME] && !!data[personalInfoKeys.LAST_NAME]) {
        skippedPages.push(PERSONAL_INFO_SUB_PAGES.LEGAL_NAME);
    }

    if (!!data[personalInfoKeys.STREET] && !!data[personalInfoKeys.CITY] && !!data[personalInfoKeys.STATE] && !!data[personalInfoKeys.ZIP_CODE]) {
        skippedPages.push(PERSONAL_INFO_SUB_PAGES.ADDRESS);
    }

    return skippedPages;
}

export default getSkippedPagesForPersonalInfo;
