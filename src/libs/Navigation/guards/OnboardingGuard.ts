import type {NavigationAction, NavigationState} from '@react-navigation/native';
import {isSingleNewDotEntrySelector} from '@selectors/HybridApp';
import {hasCompletedGuidedSetupFlowSelector, tryNewDotOnyxSelector, wasInvitedToNewDotSelector} from '@selectors/Onboarding';
import Onyx from 'react-native-onyx';
import type {OnyxEntry} from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import AccountUtils from '@libs/AccountUtils';
import {setOnboardingErrorMessage} from '@libs/actions/Welcome';
import Log from '@libs/Log';
import {isOnboardingFlowName} from '@libs/Navigation/helpers/isNavigatorName';
import {getDeepestFocusedScreen, isTwoFactorSetupScreen} from '@libs/Navigation/Navigation';
import {getOnboardingInitialPath} from '@userActions/Welcome/OnboardingFlow';
import CONFIG from '@src/CONFIG';
import CONST from '@src/CONST';
import NAVIGATORS from '@src/NAVIGATORS';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Route} from '@src/ROUTES';
import ROUTES from '@src/ROUTES';
import type {Account, Onboarding} from '@src/types/onyx';
import type {GuardResult, NavigationGuard} from './types';

type OnboardingCompanySize = ValueOf<typeof CONST.ONBOARDING_COMPANY_SIZE>;
type OnboardingPurpose = ValueOf<typeof CONST.ONBOARDING_CHOICES>;

/**
 * Module-level Onyx subscriptions for OnboardingGuard
 * These provide synchronous access to onboarding-related data
 */
let onboarding: OnyxEntry<Onboarding>;
let account: OnyxEntry<Account>;
let tryNewDot: {isHybridAppOnboardingCompleted: boolean | undefined; hasBeenAddedToNudgeMigration: boolean} | undefined;
let hybridApp: {isSingleNewDotEntry?: boolean} | undefined;
let onboardingPurposeSelected: OnyxEntry<OnboardingPurpose>;
let onboardingCompanySize: OnyxEntry<OnboardingCompanySize>;
let onboardingInitialPath: OnyxEntry<string>;
let hasNonPersonalPolicy: OnyxEntry<boolean>;
let wasInvitedToNewDot: boolean | undefined;

Onyx.connectWithoutView({
    key: ONYXKEYS.NVP_ONBOARDING,
    callback: (value) => {
        onboarding = value;
    },
});

Onyx.connectWithoutView({
    key: ONYXKEYS.ACCOUNT,
    callback: (value) => {
        account = value;
    },
});

Onyx.connectWithoutView({
    key: ONYXKEYS.NVP_TRY_NEW_DOT,
    callback: (value) => {
        tryNewDot = value ? tryNewDotOnyxSelector(value) : undefined;
    },
});

Onyx.connectWithoutView({
    key: ONYXKEYS.HYBRID_APP,
    callback: (value) => {
        hybridApp = {isSingleNewDotEntry: value ? isSingleNewDotEntrySelector(value) : undefined};
    },
});

Onyx.connectWithoutView({
    key: ONYXKEYS.ONBOARDING_PURPOSE_SELECTED,
    callback: (value) => {
        onboardingPurposeSelected = value;
    },
});

Onyx.connectWithoutView({
    key: ONYXKEYS.ONBOARDING_COMPANY_SIZE,
    callback: (value) => {
        onboardingCompanySize = value;
    },
});

Onyx.connectWithoutView({
    key: ONYXKEYS.ONBOARDING_LAST_VISITED_PATH,
    callback: (value) => {
        onboardingInitialPath = value;
    },
});

Onyx.connectWithoutView({
    key: ONYXKEYS.HAS_NON_PERSONAL_POLICY,
    callback: (value) => {
        hasNonPersonalPolicy = value;
    },
});

Onyx.connectWithoutView({
    key: ONYXKEYS.NVP_INTRO_SELECTED,
    callback: (value) => {
        wasInvitedToNewDot = value ? wasInvitedToNewDotSelector(value) : undefined;
    },
});

/**
 * Helper to get the correct onboarding route based on current progress
 */
function getOnboardingRoute(): Route {
    return getOnboardingInitialPath({
        onboardingValuesParam: onboarding,
        isUserFromPublicDomain: !!account?.isFromPublicDomain,
        hasAccessiblePolicies: !!account?.hasAccessibleDomainPolicies,
        currentOnboardingCompanySize: onboardingCompanySize,
        currentOnboardingPurposeSelected: onboardingPurposeSelected,
        onboardingInitialPath,
        onboardingValues: onboarding,
        isAccountValidated: !!account?.validated,
    }) as Route;
}

/**
 * Whether the required-2FA setup is currently active, using the same shared predicate as the overlay/hook.
 */
function shouldShowRequire2FA(): boolean {
    const isOnboardingCompleted = hasCompletedGuidedSetupFlowSelector(onboarding) ?? false;
    return AccountUtils.shouldShowRequire2FAPage(account, isOnboardingCompleted);
}

/**
 * Resolve the deepest focused screen from a navigation action payload. Handles both full NavigationState payloads
 * (RESET) and NAVIGATE `{name, params: {screen}}` payloads. Centralizing the payload cast here keeps it to a single
 * assertion shared by shouldPreventReset and the evaluate 2FA exception.
 */
function getTargetScreenFromAction(action: NavigationAction) {
    return getDeepestFocusedScreen(action.payload as NavigationState | undefined);
}

function shouldPreventReset(state: NavigationState, action: NavigationAction) {
    if (action.type !== CONST.NAVIGATION_ACTIONS.RESET || !action?.payload) {
        return false;
    }

    const currentFocusedRoute = getDeepestFocusedScreen(state);
    const targetFocusedRoute = getTargetScreenFromAction(action);

    // While required 2FA setup is active, allow RESET into a 2FA setup screen. The required-2FA overlay floats over
    // onboarding and its CTA resets into the 2FA setup flow; blocking it would trap the user behind the overlay.
    if (shouldShowRequire2FA() && isTwoFactorSetupScreen(targetFocusedRoute?.name)) {
        return false;
    }

    // We want to prevent the user from navigating back to a non-onboarding screen if they are currently on an onboarding screen
    if (isOnboardingFlowName(currentFocusedRoute?.name) && !isOnboardingFlowName(targetFocusedRoute?.name)) {
        setOnboardingErrorMessage('onboarding.purpose.errorBackButton');
        return true;
    }

    return false;
}

/**
 * Check if the navigation action is targeting an onboarding screen.
 * This handles NAVIGATE/PUSH actions that target the OnboardingModalNavigator directly.
 */
function isNavigatingToOnboardingFlow(action: NavigationAction): boolean {
    if (
        (action.type === CONST.NAVIGATION.ACTION_TYPE.NAVIGATE || action.type === CONST.NAVIGATION.ACTION_TYPE.PUSH) &&
        (action.payload as {name?: string} | undefined)?.name === NAVIGATORS.ONBOARDING_MODAL_NAVIGATOR
    ) {
        return true;
    }

    return false;
}

/**
 * Check if the navigation action is targeting an onboarding screen.
 * This handles REPLACE actions that target the OnboardingModalNavigator directly.
 */
function isNavigatingToOnboardingFlowWithReplaceAction(action: NavigationAction): boolean {
    return action.type === CONST.NAVIGATION.ACTION_TYPE.REPLACE && (action.payload as {name?: string} | undefined)?.name === NAVIGATORS.ONBOARDING_MODAL_NAVIGATOR;
}

/**
 * OnboardingGuard handles ONLY the core NewDot onboarding flow
 */
const OnboardingGuard: NavigationGuard = {
    name: 'OnboardingGuard',

    evaluate: (state, action, context): GuardResult => {
        if (shouldPreventReset(state, action)) {
            return {type: 'BLOCK', reason: 'Cannot reset to non-onboarding screen while on onboarding'};
        }

        // Required-2FA exception: while required 2FA setup is active, allow navigation that targets a 2FA setup screen
        // (the "Enable two-factor authentication" CTA) and allow in-wizard steps while already on a 2FA setup screen
        // (forceReplace between steps). Without this, the guard would redirect the 2FA navigation back to onboarding and
        // the user would stay trapped behind the require-2FA overlay.
        // getDeepestFocusedScreen (not findFocusedRoute) resolves the target from both full NavigationState payloads and
        // NAVIGATE `{name, params: {screen}}` payloads.
        if (shouldShowRequire2FA()) {
            const targetScreen = getTargetScreenFromAction(action);
            const currentScreen = getDeepestFocusedScreen(state);
            if (isTwoFactorSetupScreen(targetScreen?.name) || isTwoFactorSetupScreen(currentScreen?.name)) {
                Log.info('[OnboardingGuard] Allowing 2FA setup navigation during required 2FA', false, {
                    targetScreen: targetScreen?.name,
                    currentScreen: currentScreen?.name,
                });
                return {type: 'ALLOW'};
            }
        }

        const isTransitioning = context.currentUrl?.includes(ROUTES.TRANSITION_BETWEEN_APPS);
        const isOnboardingCompleted = hasCompletedGuidedSetupFlowSelector(onboarding) ?? false;
        const isMigratedUser = tryNewDot?.hasBeenAddedToNudgeMigration ?? false;
        const isSingleEntry = hybridApp?.isSingleNewDotEntry ?? false;
        const needsExplanationModal = (CONFIG.IS_HYBRID_APP && tryNewDot?.isHybridAppOnboardingCompleted !== true) ?? false;
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        const isInvitedOrGroupMember = (hasNonPersonalPolicy || wasInvitedToNewDot) ?? false;

        // Redirect completed users who try to navigate to onboarding routes (e.g. via deep link)
        // The OnboardingModalNavigator is not mounted when onboarding is complete, so the route would silently fail
        if ((isOnboardingCompleted || CONFIG.SKIP_ONBOARDING) && isNavigatingToOnboardingFlow(action)) {
            Log.info('[OnboardingGuard] Redirecting user away from onboarding route to home');
            return {type: 'REDIRECT', route: ROUTES.HOME};
        }

        const skipOnboardingConfig = CONFIG.SKIP_ONBOARDING;
        const isLoading = context.isLoading;
        const isNavigatingWithReplace = isNavigatingToOnboardingFlowWithReplaceAction(action);

        const shouldSkipOnboarding =
            skipOnboardingConfig ||
            isLoading ||
            isTransitioning ||
            isOnboardingCompleted ||
            isMigratedUser ||
            isInvitedOrGroupMember ||
            isSingleEntry ||
            needsExplanationModal ||
            isNavigatingWithReplace;

        if (shouldSkipOnboarding) {
            return {type: 'ALLOW'};
        }

        // If the OnboardingModalNavigator is the currently focused route, the user is already
        // on the onboarding flow. Redirecting again would produce a redundant state reset that
        // triggers further actions, creating an infinite navigation loop (APP-7FR).
        const isOnboardingFocused = state.routes[state.index]?.name === NAVIGATORS.ONBOARDING_MODAL_NAVIGATOR;
        if (isOnboardingFocused) {
            return {type: 'ALLOW'};
        }

        // User needs onboarding - calculate the correct step and redirect
        const onboardingRoute = getOnboardingRoute();

        Log.info('[OnboardingGuard] Redirecting to onboarding route', false, {
            onboardingRoute,
            skipOnboardingConfig,
            isLoading,
            isTransitioning,
            isOnboardingCompleted,
            isMigratedUser,
            isSingleEntry,
            needsExplanationModal,
            isInvitedOrGroupMember,
            isNavigatingWithReplace,
        });

        return {
            type: 'REDIRECT',
            route: onboardingRoute,
        };
    },
};

export default OnboardingGuard;
