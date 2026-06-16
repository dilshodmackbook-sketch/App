import type {OnyxEntry} from 'react-native-onyx';
import CONST from '@src/CONST';
import type {Account} from '@src/types/onyx';

const isValidateCodeFormSubmitting = (account: OnyxEntry<Account>) =>
    !!account?.isLoading && account.loadingForm === (account.requiresTwoFactorAuth ? CONST.FORMS.VALIDATE_TFA_CODE_FORM : CONST.FORMS.VALIDATE_CODE_FORM);

function isDelegateOnlySubmitter(account: OnyxEntry<Account>): boolean {
    const delegateEmail = account?.delegatedAccess?.delegate;
    const delegateRole = account?.delegatedAccess?.delegates?.find((delegate) => delegate.email === delegateEmail)?.role;

    return delegateRole === CONST.DELEGATE_ROLE.SUBMITTER;
}

/**
 * Check if the current user has validateCodeExtendedAccess
 *
 * This is a UX optimization to avoid asking for validation codes when the user
 * has recently provided one.
 * The backend performs an authoritative validation check using server-side time.
 *
 * @return true if the user has extended access, false otherwise
 */
function hasValidateCodeExtendedAccess(account: OnyxEntry<Account>): boolean {
    const extendedAccessTimestamp = account?.validateCodeExtendedAccessExpires;
    if (extendedAccessTimestamp) {
        // Convert timestamp from microseconds to milliseconds and compare with current time
        const extendedAccessExpiration = parseInt(extendedAccessTimestamp.toString(), 10) / 1000;
        if (Date.now() <= extendedAccessExpiration) {
            return true;
        }
    }

    return false;
}

/**
 * Whether the user is in the "forced" 2FA onboarding setup state: a guided-setup user whose
 * backend record has 2FA setup in progress but who hasn't completed onboarding yet.
 * This is the second clause of `shouldShowRequire2FAPage` and is true even when `requiresTwoFactorAuth` is true.
 */
function isForced2FAOnboardingSetup(account: OnyxEntry<Account>, hasCompletedGuidedSetupFlow: boolean | undefined): boolean {
    return !!account?.twoFactorAuthSetupInProgress && !hasCompletedGuidedSetupFlow;
}

/**
 * Pure computation of whether the RequireTwoFactorAuthenticationOverlay should be shown.
 * Kept here (rather than only in the hook) so the navigation guard, the wizard pages and the
 * onboarding router can share the exact same condition.
 */
function shouldShowRequire2FAPage(account: OnyxEntry<Account>, hasCompletedGuidedSetupFlow: boolean | undefined): boolean {
    return (!!account?.needsTwoFactorAuthSetup && !account?.requiresTwoFactorAuth) || isForced2FAOnboardingSetup(account, hasCompletedGuidedSetupFlow);
}

export default {isValidateCodeFormSubmitting, isDelegateOnlySubmitter, hasValidateCodeExtendedAccess, isForced2FAOnboardingSetup, shouldShowRequire2FAPage};
