import CaretBackHeader from '@components/CaretBackHeader';

import useSafeAreaPaddings from '@hooks/useSafeAreaPaddings';
import useTheme from '@hooks/useTheme';

import type {ReactNode} from 'react';

import {useFocusEffect} from '@react-navigation/native';
import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {View} from 'react-native';

type OnboardingHeaderConfig = {
    /** Whether the sticky back caret should be visible for the focused step */
    shouldShowBackButton: boolean;

    /** What the back caret does when pressed on the focused step */
    onBackButtonPress?: () => void;
};

const DEFAULT_CONFIG: OnboardingHeaderConfig = {shouldShowBackButton: false};

// Holds the config the currently focused step wants the sticky header to render.
const OnboardingHeaderConfigContext = createContext<OnboardingHeaderConfig>(DEFAULT_CONFIG);

// Lets a focused step register its config. The setter from useState is stable, so consumers that
// only register (i.e. every step) never re-render when the config value itself changes.
const OnboardingHeaderRegisterContext = createContext<(config: OnboardingHeaderConfig) => void>(() => {});

function OnboardingHeaderContextProvider({children}: {children: ReactNode}) {
    const [config, setConfig] = useState<OnboardingHeaderConfig>(DEFAULT_CONFIG);

    return (
        <OnboardingHeaderRegisterContext.Provider value={setConfig}>
            <OnboardingHeaderConfigContext.Provider value={config}>{children}</OnboardingHeaderConfigContext.Provider>
        </OnboardingHeaderRegisterContext.Provider>
    );
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
 * The single back caret header mounted once above the onboarding stack. Because it lives outside the
 * animated screen cards it never slides with a transition. On the narrow (fullscreen) layout it owns
 * the top safe-area inset that each step's ScreenWrapper used to provide, so the caret stays clear of
 * the status bar / notch and remains tappable.
 */
function OnboardingStickyHeader({shouldApplyTopInset}: {shouldApplyTopInset: boolean}) {
    const theme = useTheme();
    const {paddingTop} = useSafeAreaPaddings();
    const {shouldShowBackButton, onBackButtonPress} = useContext(OnboardingHeaderConfigContext);

    return (
        <View style={[{backgroundColor: theme.componentBG}, shouldApplyTopInset && {paddingTop}]}>
            <CaretBackHeader
                shouldShowBackButton={shouldShowBackButton}
                onBackButtonPress={onBackButtonPress}
            />
        </View>
    );
}

export {OnboardingHeaderContextProvider, OnboardingStickyHeader, useOnboardingHeaderConfig};
export type {OnboardingHeaderConfig};
