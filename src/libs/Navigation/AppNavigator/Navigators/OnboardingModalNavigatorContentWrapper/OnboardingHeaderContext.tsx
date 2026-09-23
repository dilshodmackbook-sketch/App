import CaretBackHeader from '@components/CaretBackHeader';

import useSafeAreaPaddings from '@hooks/useSafeAreaPaddings';
import useTheme from '@hooks/useTheme';

import type {FocusTrapProps} from 'focus-trap-react';
import type {ReactNode} from 'react';

import {useFocusEffect} from '@react-navigation/native';
import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {View} from 'react-native';

type OnboardingHeaderConfig = {
    /** Whether the sticky back caret should be visible for the focused step */
    shouldShowBackButton: boolean;

    /** What the back caret does when pressed on the focused step */
    onBackButtonPress?: () => void;
};

type OnboardingScreenFocusTrap = {
    /** Ref to attach to the step's ScreenWrapper so its container joins the shared focus trap */
    screenWrapperRef: (node: View | null) => void;

    /** Focus trap settings to pass to the step's ScreenWrapper */
    focusTrapSettings: Pick<FocusTrapProps, 'containerElements'>;
};

const DEFAULT_CONFIG: OnboardingHeaderConfig = {shouldShowBackButton: false};

// Holds the config the currently focused step wants the sticky header to render.
const OnboardingHeaderConfigContext = createContext<OnboardingHeaderConfig>(DEFAULT_CONFIG);

// Lets a focused step register its config. The setter from useState is stable, so consumers that
// only register (i.e. every step) never re-render when the config value itself changes.
const OnboardingHeaderRegisterContext = createContext<(config: OnboardingHeaderConfig) => void>(() => {});

// Holds the sticky header's DOM node so a focused step can include it in its own focus trap.
const OnboardingHeaderElementContext = createContext<HTMLElement | null>(null);

// Lets the sticky header register its DOM node. The setter from useState is stable.
const OnboardingHeaderElementSetterContext = createContext<(element: HTMLElement | null) => void>(() => {});

function OnboardingHeaderContextProvider({children}: {children: ReactNode}) {
    const [config, setConfig] = useState<OnboardingHeaderConfig>(DEFAULT_CONFIG);
    const [headerElement, setHeaderElement] = useState<HTMLElement | null>(null);

    return (
        <OnboardingHeaderRegisterContext.Provider value={setConfig}>
            <OnboardingHeaderConfigContext.Provider value={config}>
                <OnboardingHeaderElementSetterContext.Provider value={setHeaderElement}>
                    <OnboardingHeaderElementContext.Provider value={headerElement}>{children}</OnboardingHeaderElementContext.Provider>
                </OnboardingHeaderElementSetterContext.Provider>
            </OnboardingHeaderConfigContext.Provider>
        </OnboardingHeaderRegisterContext.Provider>
    );
}

// A host View ref resolves to its DOM node on web; on native there is no focus trap and HTMLElement
// is not defined, so we guard the check and treat the node as absent.
function getHTMLElementFromViewRef(node: unknown): HTMLElement | null {
    return typeof HTMLElement !== 'undefined' && node instanceof HTMLElement ? node : null;
}

/**
 * Registers the focused step's back caret config with the shared sticky header.
 * The registration runs on focus (via useFocusEffect) so the incoming step always drives the
 * header and the outgoing step's values do not linger during the slide transition.
 * The press handler is read through a ref so a fresh inline handler each render does not trigger
 * an extra re-registration, while the caret still invokes the latest handler.
 */
function useOnboardingHeaderConfig({shouldShowBackButton, onBackButtonPress}: OnboardingHeaderConfig) {
    const register = useContext(OnboardingHeaderRegisterContext);
    const onBackButtonPressRef = useRef(onBackButtonPress);

    useEffect(() => {
        onBackButtonPressRef.current = onBackButtonPress;
    }, [onBackButtonPress]);

    useFocusEffect(
        useCallback(() => {
            register({
                shouldShowBackButton,
                onBackButtonPress: () => onBackButtonPressRef.current?.(),
            });
        }, [register, shouldShowBackButton]),
    );
}

/**
 * Returns the ref + focus trap settings for the onboarding screen wrapper so the sticky Back caret,
 * which is mounted outside every step, still belongs to the focused step's trap on web. The header is
 * listed first so the Tab order stays Back -> content -> Continue, as on main. No-op on native, where
 * there is no focus trap.
 */
function useOnboardingFocusTrapContainers(): OnboardingScreenFocusTrap {
    const headerElement = useContext(OnboardingHeaderElementContext);
    const [ownElement, setOwnElement] = useState<HTMLElement | null>(null);

    const screenWrapperRef = useCallback((node: View | null) => {
        setOwnElement(getHTMLElementFromViewRef(node));
    }, []);

    const containerElements = useMemo(() => [headerElement, ownElement].filter((element): element is HTMLElement => !!element), [headerElement, ownElement]);

    return {screenWrapperRef, focusTrapSettings: {containerElements}};
}

/**
 * The single back caret header mounted once above the onboarding stack. Because it lives outside the
 * animated screen cards it never slides with a transition. On the narrow (fullscreen) layout it owns
 * the top safe-area inset that each step's ScreenWrapper used to provide, so the caret stays clear of
 * the status bar / notch and remains tappable.
 */
function OnboardingStickyHeader({shouldApplyTopInset}: {shouldApplyTopInset: boolean}) {
    const theme = useTheme();
    const {paddingTop} = useSafeAreaPaddings();
    const {shouldShowBackButton, onBackButtonPress} = useContext(OnboardingHeaderConfigContext);
    const setHeaderElement = useContext(OnboardingHeaderElementSetterContext);

    const headerRef = useCallback(
        (node: View | null) => {
            setHeaderElement(getHTMLElementFromViewRef(node));
        },
        [setHeaderElement],
    );

    return (
        <View
            ref={headerRef}
            style={[{backgroundColor: theme.componentBG}, shouldApplyTopInset && {paddingTop}]}
        >
            <CaretBackHeader
                shouldShowBackButton={shouldShowBackButton}
                onBackButtonPress={onBackButtonPress}
            />
        </View>
    );
}

export {OnboardingHeaderContextProvider, OnboardingStickyHeader, useOnboardingHeaderConfig, useOnboardingFocusTrapContainers};
export type {OnboardingHeaderConfig};
