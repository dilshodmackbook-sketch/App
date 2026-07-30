import Icon from '@components/Icon';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import Text from '@components/Text';

import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';

import variables from '@styles/variables';

import CONST from '@src/CONST';

import React from 'react';
import {View} from 'react-native';

type CollapsedSystemMessagesProps = {
    /** Number of system messages in the collapsed run */
    count: number;

    /** Whether the run is currently expanded */
    isExpanded: boolean;

    /** Toggle the run open/closed */
    onPress: () => void;
};

function CollapsedSystemMessages({count, isExpanded, onPress}: CollapsedSystemMessagesProps) {
    const styles = useThemeStyles();
    const theme = useTheme();
    const {translate} = useLocalize();
    const icons = useMemoizedLazyExpensifyIcons(['DownArrow', 'UpArrow']);

    const label = translate('report.collapsedSystemMessages', {count});

    return (
        <PressableWithFeedback
            onPress={onPress}
            role={CONST.ROLE.BUTTON}
            accessibilityLabel={label}
            accessibilityState={{expanded: isExpanded}}
            sentryLabel="CollapsedSystemMessages"
            style={[styles.flexRow, styles.alignItemsCenter, styles.gap2, styles.pv1, styles.pl5, styles.pr5]}
        >
            <Text style={[styles.textLabelSupporting]}>{label}</Text>
            <Icon
                src={isExpanded ? icons.UpArrow : icons.DownArrow}
                fill={theme.icon}
                width={variables.iconSizeExtraSmall}
                height={variables.iconSizeExtraSmall}
            />
            <View style={styles.flex1} />
        </PressableWithFeedback>
    );
}

CollapsedSystemMessages.displayName = 'CollapsedSystemMessages';

export default CollapsedSystemMessages;
