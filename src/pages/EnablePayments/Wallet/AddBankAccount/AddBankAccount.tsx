import FullScreenLoadingIndicator from '@components/FullscreenLoadingIndicator';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import InteractiveStepSubHeader from '@components/InteractiveStepSubHeader';
import {KYCWallContext} from '@components/KYCWall/KYCWallContext';
import ScreenWrapper from '@components/ScreenWrapper';

import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import useSubPage from '@hooks/useSubPage';
import type {SubPageProps} from '@hooks/useSubPage/types';
import useThemeStyles from '@hooks/useThemeStyles';

import {addPersonalBankAccount, clearPersonalBankAccount} from '@libs/actions/BankAccounts';
import {setDraftValues} from '@libs/actions/FormActions';
import {continueSetup} from '@libs/actions/PaymentMethods';
import {updateCurrentStep} from '@libs/actions/Wallet';
import {hasLegalName} from '@libs/PersonalDetailsUtils';

import Navigation from '@navigation/Navigation';

import LegalName from '@pages/AddPersonalBankAccountPage/substeps/LegalNameStep';
import getBankAccountOwnerDetails, {hasCompleteUSAddress} from '@pages/EnablePayments/Wallet/utils/getBankAccountOwnerDetails';
import useIsBankAccountAdded from '@pages/EnablePayments/Wallet/utils/useIsBankAccountAdded';

import CONST from '@src/CONST';
import type {EnablePaymentsSubPageType} from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';

import React, {useCallback, useContext} from 'react';
import {View} from 'react-native';

import SetupMethod from './SetupMethod';
import Address from './substeps/AddressStep';
import Confirmation from './substeps/ConfirmationStep';
import Plaid from './substeps/PlaidStep';

const ADD_BANK_ACCOUNT_SUB_PAGES = CONST.ENABLE_PAYMENTS.ADD_BANK_ACCOUNT_STEP.SUB_PAGE_NAMES;

const plaidPages = [
    {pageName: ADD_BANK_ACCOUNT_SUB_PAGES.PLAID, component: Plaid},
    {pageName: ADD_BANK_ACCOUNT_SUB_PAGES.LEGAL_NAME, component: LegalName},
    {pageName: ADD_BANK_ACCOUNT_SUB_PAGES.ADDRESS, component: Address},
    {pageName: ADD_BANK_ACCOUNT_SUB_PAGES.CONFIRMATION, component: Confirmation},
];

const confirmationPageIndex = plaidPages.findIndex((page) => page.pageName === ADD_BANK_ACCOUNT_SUB_PAGES.CONFIRMATION);

function AddBankAccount() {
    const [plaidData] = useOnyx(ONYXKEYS.PLAID_DATA);
    const [personalBankAccount] = useOnyx(ONYXKEYS.PERSONAL_BANK_ACCOUNT);
    const [personalBankAccountDraft] = useOnyx(ONYXKEYS.FORMS.PERSONAL_BANK_ACCOUNT_FORM_DRAFT);
    const [privatePersonalDetails] = useOnyx(ONYXKEYS.PRIVATE_PERSONAL_DETAILS);
    const [personalPolicyID] = useOnyx(ONYXKEYS.PERSONAL_POLICY_ID);
    const {translate} = useLocalize();
    const styles = useThemeStyles();
    const kycWallRef = useContext(KYCWallContext);

    const {isBankAccountAdded: isBankAccountAlreadyAdded} = useIsBankAccountAdded();

    const submit = useCallback(() => {
        // Re-submitting an already added bank account fails with a "bank account already exists" error, so skip the
        // API call and advance the wallet step instead; the URL correction in EnablePaymentsPage navigates forward.
        if (isBankAccountAlreadyAdded) {
            updateCurrentStep(CONST.WALLET.STEP.ADDITIONAL_DETAILS);
            return;
        }

        const bankAccounts = plaidData?.bankAccounts ?? [];
        const selectedPlaidBankAccount = bankAccounts.find((bankAccount) => bankAccount.plaidAccountID === personalBankAccountDraft?.plaidAccountID);

        if (selectedPlaidBankAccount) {
            const bankAccountWithToken = selectedPlaidBankAccount.plaidAccessToken
                ? selectedPlaidBankAccount
                : {
                      ...selectedPlaidBankAccount,
                      plaidAccessToken: plaidData?.plaidAccessToken ?? '',
                  };

            const ownerDetails = getBankAccountOwnerDetails(privatePersonalDetails, personalBankAccountDraft);
            addPersonalBankAccount({...personalBankAccountDraft, ...ownerDetails, ...bankAccountWithToken}, personalPolicyID);

            // Hand the same name and address to the KYC step so it doesn't ask for them again
            setDraftValues(ONYXKEYS.FORMS.WALLET_ADDITIONAL_DETAILS, {
                legalFirstName: ownerDetails.legalFirstName,
                legalLastName: ownerDetails.legalLastName,
                addressStreet: [ownerDetails.addressStreet, ownerDetails.addressStreet2].filter(Boolean).join(', '),
                addressCity: ownerDetails.addressCity,
                addressState: ownerDetails.addressState,
                addressZipCode: ownerDetails.addressZipCode,
            });
        }
    }, [isBankAccountAlreadyAdded, personalBankAccountDraft, plaidData?.bankAccounts, plaidData?.plaidAccessToken, personalPolicyID, privatePersonalDetails]);

    const isSetupTypeChosen = personalBankAccountDraft?.setupType === CONST.BANK_ACCOUNT.SETUP_TYPE.PLAID;

    // Only ask for the name/address we don't already have on file, same as the standalone flow
    const skipPages = [
        hasLegalName(privatePersonalDetails) ? ADD_BANK_ACCOUNT_SUB_PAGES.LEGAL_NAME : undefined,
        hasCompleteUSAddress(privatePersonalDetails) ? ADD_BANK_ACCOUNT_SUB_PAGES.ADDRESS : undefined,
    ].filter((pageName): pageName is NonNullable<typeof pageName> => !!pageName);

    const {CurrentPage, isEditing, pageIndex, nextPage, prevPage, moveTo, isRedirecting} = useSubPage<SubPageProps, EnablePaymentsSubPageType>({
        pages: plaidPages,
        skipPages,
        // Once the bank account is added there is nothing to redo on the Plaid sub-page, so a revisit shows only the confirmation.
        startFrom: isBankAccountAlreadyAdded ? confirmationPageIndex : 0,
        onFinished: submit,
        buildRoute: (pageName, action) =>
            ROUTES.SETTINGS_ENABLE_PAYMENTS.getRoute({
                page: CONST.ENABLE_PAYMENTS.PAGE_NAMES.ADD_BANK_ACCOUNT,
                subPage: pageName,
                action,
            }),
    });

    const exitFlow = (shouldContinue = false) => {
        const onSuccessFallbackRoute = personalBankAccount?.onSuccessFallbackRoute ?? '';

        if (shouldContinue && onSuccessFallbackRoute) {
            continueSetup(kycWallRef, onSuccessFallbackRoute);
            return;
        }
        Navigation.goBack(ROUTES.SETTINGS_WALLET);
    };

    const handleBackButtonPress = () => {
        // The bank account is already added, so the confirmation is the only visible sub-page of this step — back exits the flow.
        if (isBankAccountAlreadyAdded) {
            Navigation.goBack(ROUTES.SETTINGS_WALLET);
            return;
        }

        if (!isSetupTypeChosen) {
            exitFlow();
            return;
        }

        if (pageIndex === 0) {
            // Clearing the draft clears setupType, which switches this page back to the setup method view.
            clearPersonalBankAccount();
            return;
        }
        prevPage();
    };

    if ((isSetupTypeChosen || isBankAccountAlreadyAdded) && isRedirecting) {
        return <FullScreenLoadingIndicator />;
    }

    return (
        <ScreenWrapper
            testID="AddBankAccount"
            includeSafeAreaPaddingBottom={false}
            shouldEnablePickerAvoiding={false}
            shouldShowOfflineIndicator
            shouldShowOfflineIndicatorInWideScreen
        >
            <HeaderWithBackButton
                shouldShowBackButton
                onBackButtonPress={handleBackButtonPress}
                title={translate('bankAccount.addBankAccount')}
            />
            <View style={styles.flex1}>
                {isSetupTypeChosen || isBankAccountAlreadyAdded ? (
                    <>
                        <View style={[styles.ph5, styles.mb5, styles.mt3, {height: CONST.BANK_ACCOUNT.STEPS_HEADER_HEIGHT}]}>
                            <InteractiveStepSubHeader
                                startStepIndex={0}
                                stepNames={CONST.WALLET.STEP_NAMES}
                                currentStepAccessibilityDescription={translate('bankAccount.addBankAccount')}
                            />
                        </View>
                        <CurrentPage
                            isEditing={isEditing}
                            onNext={nextPage}
                            onMove={moveTo}
                        />
                    </>
                ) : (
                    <SetupMethod />
                )}
            </View>
        </ScreenWrapper>
    );
}

export default AddBankAccount;
