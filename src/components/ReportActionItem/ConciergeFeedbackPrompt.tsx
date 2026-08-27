import type {Emoji} from '@assets/emojis/types';

import Button from '@components/ButtonComposed';
import Text from '@components/Text';

import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import useThemeStyles from '@hooks/useThemeStyles';

import {findEmojiByName, hasAccountIDEmojiReacted} from '@libs/EmojiUtils';

import {toggleEmojiReaction} from '@userActions/EmojiReactions';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {ReportAction, ReportActionReactions} from '@src/types/onyx';

import React, {useState} from 'react';

import ActionableItemButtons from './ActionableItemButtons';

type ConciergeFeedbackPromptProps = {
    /** The Concierge-authored action this prompt rates */
    action: ReportAction;

    /** The report the action is displayed in */
    reportID: string | undefined;

    /** The report that owns the action for mutations (thread / merged-list cases use the original report) */
    originalReportID?: string;
};

const THUMBS_UP = findEmojiByName('+1');
const THUMBS_DOWN = findEmojiByName('-1');

/**
 * Reads whether the current user has already reacted with the given emoji, regardless of key format or skin tone.
 *
 * The reactions map is dual-keyed during the legacy→canonical transition: the same 👍 can be stored under
 * the legacy name key (`+1`) or under its hexcode (`1F44D`). We check both, and pass no skin tone so any
 * variant counts — mirroring how `toggleEmojiReaction` resolves the entry to toggle off.
 */
function hasReactedWithEmoji(accountID: number, reactions: ReportActionReactions | undefined, emoji: Emoji): boolean {
    const entries = [reactions?.[emoji.name], emoji.hexcode ? reactions?.[emoji.hexcode] : undefined];
    return entries.some((entry) => !!entry && hasAccountIDEmojiReacted(accountID, entry.users));
}

/**
 * A lightweight "Was this response useful? 👍 👎" prompt shown under the latest Concierge response.
 *
 * A thumb adds a real emoji reaction (👍 also shows a transient thanks); the backend derives the feedback
 * signal from the reaction, so the frontend creates no thread and needs no new API. Because eligibility is
 * gated on the reaction itself, the prompt hides optimistically, stays hidden after reload, and becomes
 * eligible again if the user retracts the reaction — with no dismissed flag to persist.
 */
function ConciergeFeedbackPrompt({action, reportID, originalReportID}: ConciergeFeedbackPromptProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const {accountID} = useCurrentUserPersonalDetails();

    const [preferredSkinTone = CONST.EMOJI_DEFAULT_SKIN_TONE] = useOnyx(ONYXKEYS.PREFERRED_EMOJI_SKIN_TONE);
    const [reactions] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS_REACTIONS}${action.reportActionID}`);
    const [reportActions] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${originalReportID ?? reportID}`);

    const [hasThankedUser, setHasThankedUser] = useState(false);

    const hasRated = hasReactedWithEmoji(accountID, reactions, THUMBS_UP) || hasReactedWithEmoji(accountID, reactions, THUMBS_DOWN);

    const rate = (emoji: Emoji, isPositive: boolean) => {
        // `ignoreSkinToneOnCompare` (last arg) matches the reaction row: +1/-1 carry skin-tone variants, so a
        // user whose preferred tone differs from the stored one must still toggle, not add a duplicate.
        toggleEmojiReaction(reportID, action, emoji, reactions, preferredSkinTone, accountID, reportActions, true);
        if (isPositive) {
            setHasThankedUser(true);
        }
    };

    // Check the transient thanks BEFORE the reaction gate: tapping 👍 flips `hasRated` in the same commit,
    // so gating on it first would unmount the acknowledgement before it paints.
    if (hasThankedUser) {
        return <Text style={[styles.mt2, styles.textSupporting]}>{translate('concierge.feedback.thanks')}</Text>;
    }

    if (hasRated) {
        return null;
    }

    return (
        <>
            <Text style={[styles.mt2, styles.textSupporting]}>{translate('concierge.feedback.prompt')}</Text>
            <ActionableItemButtons layout="horizontal">
                <Button
                    accessibilityLabel={translate('concierge.feedback.useful')}
                    onPress={() => rate(THUMBS_UP, true)}
                >
                    <Button.Text>{THUMBS_UP.code}</Button.Text>
                </Button>
                <Button
                    accessibilityLabel={translate('concierge.feedback.notUseful')}
                    onPress={() => rate(THUMBS_DOWN, false)}
                >
                    <Button.Text>{THUMBS_DOWN.code}</Button.Text>
                </Button>
            </ActionableItemButtons>
        </>
    );
}

ConciergeFeedbackPrompt.displayName = 'ConciergeFeedbackPrompt';

export default ConciergeFeedbackPrompt;
