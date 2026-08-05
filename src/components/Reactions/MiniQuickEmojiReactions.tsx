import type {Emoji} from '@assets/emojis/types';

import BaseMiniContextMenuItem from '@components/BaseMiniContextMenuItem';
import Icon from '@components/Icon';
import Text from '@components/Text';

import useArrowKeyFocusManager from '@hooks/useArrowKeyFocusManager';
import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import useStyleUtils from '@hooks/useStyleUtils';
import useSyncFocus from '@hooks/useSyncFocus';
import useThemeStyles from '@hooks/useThemeStyles';

import {getLocalizedEmojiName, getPreferredEmojiCode} from '@libs/EmojiUtils';
import getButtonState from '@libs/getButtonState';

import variables from '@styles/variables';

import {emojiPickerRef, showEmojiPicker} from '@userActions/EmojiPickerAction';
import {callFunctionIfActionIsAllowed} from '@userActions/Session';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Locale, ReportActionReactions} from '@src/types/onyx';
import {getEmptyObject} from '@src/types/utils/EmptyObject';

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {View} from 'react-native';

import type {BaseQuickEmojiReactionsProps} from './QuickEmojiReactions/types';

type MiniQuickEmojiReactionsProps = BaseQuickEmojiReactionsProps & {
    /**
     * Will be called when the user closed the emoji picker
     * without selecting an emoji.
     */
    onEmojiPickerClosed?: () => void;
};

type QuickReactionButtonProps = {
    /** The quick reaction emoji to render */
    emoji: Emoji;

    /** The user's preferred skin tone */
    preferredSkinTone: number;

    /** The user's preferred locale, used to localize the tooltip */
    preferredLocale: Locale | undefined;

    /** Whether this button currently owns the row's roving focus */
    isFocused: boolean;

    /** Called when the button receives keyboard focus */
    onFocus: () => void;

    /** Called when the user selects this reaction */
    onSelect: () => void;
};

/**
 * A single quick-reaction button that owns its own ref so it can sync real DOM focus
 * to the roving `focusedIndex` driven by the parent's arrow-key manager.
 */
function QuickReactionButton({emoji, preferredSkinTone, preferredLocale, isFocused, onFocus, onSelect}: QuickReactionButtonProps) {
    const styles = useThemeStyles();
    const buttonRef = useRef<View>(null);
    useSyncFocus(buttonRef, isFocused);

    return (
        <BaseMiniContextMenuItem
            ref={buttonRef}
            isDelayButtonStateComplete={false}
            tooltipText={`:${getLocalizedEmojiName(emoji.name, preferredLocale)}:`}
            onPress={onSelect}
            onFocus={onFocus}
            sentryLabel={CONST.SENTRY_LABEL.MINI_CONTEXT_MENU.QUICK_REACTION}
        >
            <Text
                style={[styles.miniQuickEmojiReactionText, styles.userSelectNone]}
                dataSet={{[CONST.SELECTION_SCRAPER_HIDDEN_ELEMENT]: true}}
            >
                {getPreferredEmojiCode(emoji, preferredSkinTone)}
            </Text>
        </BaseMiniContextMenuItem>
    );
}

/**
 * Shows the four common quick reactions and a
 * emoji picker icon button. This is used for the mini
 * context menu which we just show on web, when hovering
 * a message.
 */
function MiniQuickEmojiReactions({reportAction, reportActionID, onEmojiSelected, onPressOpenPicker = () => {}, onEmojiPickerClosed = () => {}}: MiniQuickEmojiReactionsProps) {
    const icons = useMemoizedLazyExpensifyIcons(['AddReaction']);
    const styles = useThemeStyles();
    const StyleUtils = useStyleUtils();
    const {translate, preferredLocale} = useLocalize();
    const [preferredSkinTone = CONST.EMOJI_DEFAULT_SKIN_TONE] = useOnyx(ONYXKEYS.PREFERRED_EMOJI_SKIN_TONE);
    const [emojiReactions = getEmptyObject<ReportActionReactions>()] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS_REACTIONS}${reportActionID}`);

    const quickReactions = useMemo(() => CONST.QUICK_REACTIONS.slice(0, 3), []);
    // Index of the add-reaction button in the row (after the quick reactions).
    const addReactionIndex = quickReactions.length;

    // The mini toolbar mounts on hover (not on focus), so arrow-key navigation must only capture keys once
    // keyboard focus is actually inside this row. Otherwise the global, non-bubbling arrow handlers registered by
    // useArrowKeyFocusManager would swallow arrow keys app-wide while a message is merely hovered.
    const containerRef = useRef<View>(null);
    const addReactionRef = useRef<View>(null);
    const [isRowFocused, setIsRowFocused] = useState(false);

    const [focusedIndex, setFocusedIndex] = useArrowKeyFocusManager({
        maxIndex: addReactionIndex,
        allowHorizontalArrowKeys: true,
        isActive: isRowFocused,
    });

    // Focus entering the row is handled per-button via onFocus. Here we only need to detect focus leaving the
    // row entirely (Tab/Shift+Tab out), so we can turn arrow capturing back off and stop owning the arrow keys.
    useEffect(() => {
        const node = containerRef.current;
        if (!(node instanceof HTMLElement)) {
            return;
        }
        const handleFocusOut = (event: FocusEvent) => {
            if (event.relatedTarget instanceof Node && node.contains(event.relatedTarget)) {
                return;
            }
            setIsRowFocused(false);
        };
        node.addEventListener('focusout', handleFocusOut);
        return () => node.removeEventListener('focusout', handleFocusOut);
    }, []);

    const handleButtonFocus = useCallback(
        (index: number) => {
            setIsRowFocused(true);
            setFocusedIndex(index);
        },
        [setFocusedIndex],
    );

    // Keep the add-reaction button's DOM focus in sync with the roving index while the row is focused.
    useSyncFocus(addReactionRef, isRowFocused && focusedIndex === addReactionIndex);

    const selectEmojiWithReaction = useCallback(
        (emoji: Emoji, skinTone: number) => {
            onEmojiSelected(emoji, emojiReactions, skinTone);
        },
        [onEmojiSelected, emojiReactions],
    );

    const openEmojiPicker = useCallback(() => {
        onPressOpenPicker();
        showEmojiPicker({
            onModalHide: onEmojiPickerClosed,
            onEmojiSelected: (_emojiCode, emojiObject, skinTone) => {
                selectEmojiWithReaction(emojiObject, skinTone);
            },
            emojiPopoverAnchor: addReactionRef,
            id: reportAction.reportActionID,
        });
    }, [onPressOpenPicker, onEmojiPickerClosed, selectEmojiWithReaction, reportAction.reportActionID]);

    // Read the emoji-picker ref inside the handler (at press time) rather than while building the onPress prop,
    // so neither React Compiler flags a ref access during render.
    const toggleEmojiPicker = useCallback(() => {
        callFunctionIfActionIsAllowed(() => {
            if (!emojiPickerRef.current?.isEmojiPickerVisible) {
                openEmojiPicker();
            } else {
                emojiPickerRef.current?.hideEmojiPicker();
            }
        })();
    }, [openEmojiPicker]);

    return (
        <View
            ref={containerRef}
            style={styles.flexRow}
        >
            {quickReactions.map((emoji: Emoji, index: number) => (
                <QuickReactionButton
                    key={emoji.name}
                    emoji={emoji}
                    preferredSkinTone={preferredSkinTone}
                    preferredLocale={preferredLocale}
                    isFocused={isRowFocused && focusedIndex === index}
                    onFocus={() => handleButtonFocus(index)}
                    onSelect={callFunctionIfActionIsAllowed(() => onEmojiSelected(emoji, emojiReactions, preferredSkinTone))}
                />
            ))}
            <BaseMiniContextMenuItem
                ref={addReactionRef}
                onPress={toggleEmojiPicker}
                onFocus={() => handleButtonFocus(addReactionIndex)}
                isDelayButtonStateComplete={false}
                tooltipText={translate('emojiReactions.addReactionTooltip')}
                sentryLabel={CONST.SENTRY_LABEL.MINI_CONTEXT_MENU.EMOJI_PICKER_BUTTON}
            >
                {({hovered, pressed}) => (
                    <Icon
                        width={variables.iconSizeMedium}
                        height={variables.iconSizeMedium}
                        src={icons.AddReaction}
                        fill={StyleUtils.getIconFillColor(getButtonState(hovered, pressed, false))}
                    />
                )}
            </BaseMiniContextMenuItem>
        </View>
    );
}

export default MiniQuickEmojiReactions;
