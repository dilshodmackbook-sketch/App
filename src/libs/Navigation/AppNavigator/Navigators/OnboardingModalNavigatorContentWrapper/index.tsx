import useThemeStyles from '@hooks/useThemeStyles';

import React from 'react';
import {View} from 'react-native';

import {OnboardingHeaderContextProvider, OnboardingStickyHeader} from './OnboardingHeaderContext';

type OnboardingModalNavigatorContentWrapperProps = {
    children: React.ReactNode;
    onboardingIsMediumOrLargerScreenWidth: boolean;
};

function OnboardingModalNavigatorContentWrapper({children, onboardingIsMediumOrLargerScreenWidth}: OnboardingModalNavigatorContentWrapperProps) {
    const styles = useThemeStyles();

    return (
        <OnboardingHeaderContextProvider>
            <View
                onClick={(e) => e.stopPropagation()}
                style={[styles.maxHeight100Percentage, styles.overflowHidden, styles.OnboardingNavigatorInnerView(onboardingIsMediumOrLargerScreenWidth)]}
            >
                <OnboardingStickyHeader shouldApplyTopInset={!onboardingIsMediumOrLargerScreenWidth} />
                <View style={styles.flex1}>{children}</View>
            </View>
        </OnboardingHeaderContextProvider>
    );
}

export default OnboardingModalNavigatorContentWrapper;
