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

    // Clicking a reaction with the mouse also focuses its button, but arrow keys should only take over the row
    // when focus arrived via the keyboard (Tab) — a mouse click must not start arrow navigation. We track the last
    // interaction, mirroring the keyboard-vs-pointer distinction EmojiPickerMenu keeps with `isUsingKeyboardMovement`:
    // keyboard input arms it, pointer input disarms it.
    const isKeyboardInteractionRef = useRef(true);

    // This is a web-only mini toolbar; bail out where there is no DOM (native) and nothing to listen to.
    useEffect(() => {
        if (typeof document === 'undefined') {
            return;
        }
        // A pointer press means the following focus is a mouse click, not keyboard navigation. Both interaction
        // listeners live on the document (capture) because the interaction that moves focus into the row (a click
        // on the button, or the Tab dispatched on the element outside it) originates outside the container node.
        const handlePointerDown = () => {
            isKeyboardInteractionRef.current = false;
        };
        // Tab/arrow keys mean the user is navigating via the keyboard, so re-arm arrow capturing.
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Tab' && !event.key.startsWith('Arrow')) {
                return;
            }
            isKeyboardInteractionRef.current = true;
        };
        document.addEventListener('pointerdown', handlePointerDown, true);
        document.addEventListener('keydown', handleKeyDown, true);

        // Focus entering the row is handled per-button via onFocus. Here we only need to detect focus leaving the
        // row entirely (Tab/Shift+Tab out), so we can turn arrow capturing back off and stop owning the arrow keys.
        const node = containerRef.current;
        const handleFocusOut = (event: FocusEvent) => {
            if (event.relatedTarget instanceof Node && node instanceof HTMLElement && node.contains(event.relatedTarget)) {
                return;
            }
            setIsRowFocused(false);
        };
        if (node instanceof HTMLElement) {
            node.addEventListener('focusout', handleFocusOut);
        }
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown, true);
            document.removeEventListener('keydown', handleKeyDown, true);
            if (node instanceof HTMLElement) {
                node.removeEventListener('focusout', handleFocusOut);
            }
        };
    }, []);

    const handleButtonFocus = useCallback(
        (index: number) => {
            // Ignore focus that came from a mouse click so arrows don't hijack the row after a pointer reaction.
            if (!isKeyboardInteractionRef.current) {
                return;
            }
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
