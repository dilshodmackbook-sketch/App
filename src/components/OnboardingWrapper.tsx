import useThemeStyles from '@hooks/useThemeStyles';

import {useOnboardingFocusTrapContainers} from '@libs/Navigation/AppNavigator/Navigators/OnboardingModalNavigatorContentWrapper/OnboardingHeaderContext';

import React from 'react';
import {View} from 'react-native';

import FocusTrapForScreens from './FocusTrap/FocusTrapForScreen';

type OnboardingWrapperProps = {
    children: React.ReactNode;
};

function OnboardingWrapper({children}: OnboardingWrapperProps) {
    const styles = useThemeStyles();
    const {screenWrapperRef, focusTrapSettings} = useOnboardingFocusTrapContainers();

    return (
        <FocusTrapForScreens focusTrapSettings={focusTrapSettings}>
            <View
                ref={screenWrapperRef}
                style={styles.h100}
            >
                {children}
            </View>
        </FocusTrapForScreens>
    );
}

export default OnboardingWrapper;
