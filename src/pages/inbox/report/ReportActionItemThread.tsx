import MultiAccountAvatar from '@components/Avatar/connected/MultiAccountAvatar';
import {usePersonalDetails} from '@components/OnyxListItemProvider';
import PressableWithSecondaryInteraction from '@components/PressableWithSecondaryInteraction';
import Text from '@components/Text';

import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import useThemeStyles from '@hooks/useThemeStyles';

import {navigateToAndOpenChildReport} from '@libs/actions/Report';
import {getParticipantsPersonalDetails} from '@libs/PersonalDetailsUtils';
import {getDelegateAccountIDFromReportAction} from '@libs/ReportActionsUtils';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report, ReportAction, ReportActions} from '@src/types/onyx';

import type {GestureResponderEvent} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';

import {hasSeenTourSelector} from '@selectors/Onboarding';
import React from 'react';
import {View} from 'react-native';

/**
 * `childOldestFourAccountIDs` stores the acted-for account for each reply and drops the copilot (delegateAccountID), so
 * a copilot reply would otherwise be summarized with the acted-for account's avatar. Build an actor -> copilot map from
 * the thread's own actions so each replier can be resolved to the copilot who acted for them. Returns `undefined` when
 * the thread's actions are not loaded (the summary is denormalized precisely so we don't fetch them), which is distinct
 * from a loaded thread that simply has no copilot replies (empty map).
 */
function getDelegateByActorAccountID(childReportActions: OnyxEntry<ReportActions>): Record<number, number> | undefined {
    const childReportActionsList = Object.values(childReportActions ?? {});
    if (childReportActionsList.length === 0) {
        return undefined;
    }
    const delegateByActorAccountID: Record<number, number> = {};
    for (const childReportAction of childReportActionsList) {
        const replyActorAccountID = Number(childReportAction?.actorAccountID);
        const replyDelegateAccountID = getDelegateAccountIDFromReportAction(childReportAction);
        if (replyDelegateAccountID && replyActorAccountID) {
            delegateByActorAccountID[replyActorAccountID] = replyDelegateAccountID;
        }
    }
    return delegateByActorAccountID;
}

/**
 * Resolve the account IDs shown in a thread summary so a copilot reply is summarized with the copilot's avatar.
 * When the thread's actions are loaded, resolve each replier from them (authoritative per replier, so an acted-for
 * account that replied on its own keeps its own avatar). When they are not loaded, fall back to the parent action's
 * copilot for its author, which keeps the summary consistent with the parent message.
 */
function getThreadSummaryAccountIDs(parentReportAction: ReportAction, delegateByActorAccountID: Record<number, number> | undefined): number[] {
    const parentDelegateAccountID = getDelegateAccountIDFromReportAction(parentReportAction);
    const parentActorAccountID = Number(parentReportAction.actorAccountID);
    return (
        parentReportAction.childOldestFourAccountIDs
            ?.split(',')
            .map((accountID) => Number(accountID))
            .filter((accountID): accountID is number => typeof accountID === 'number')
            .map((accountID) => {
                // Thread actions loaded: use the authoritative per-reply copilot (or keep the actor when it replied itself).
                if (delegateByActorAccountID) {
                    return delegateByActorAccountID[accountID] ?? accountID;
                }
                // Thread actions not loaded: fall back to the parent action's copilot for its author.
                if (parentDelegateAccountID && accountID === parentActorAccountID) {
                    return parentDelegateAccountID;
                }
                return accountID;
            }) ?? []
    );
}

export {getDelegateByActorAccountID, getThreadSummaryAccountIDs};

type ReportActionItemThreadProps = {
    /** The current report */
    report: OnyxEntry<Report>;

    /** All the data of the action item */
    reportAction: ReportAction;

    /** Whether the thread item / message is being hovered */
    isHovered: boolean;

    /** The function that should be called when the thread is LongPressed or right-clicked */
    onSecondaryInteraction: (event: GestureResponderEvent | MouseEvent) => void;

    /** True when this message is edited inline on a wide layout; right-aligns the reaction row under the composer. */
    isEditingInline: boolean;

    /** Whether the thread item / message is active */
    isActive?: boolean;
};

function ReportActionItemThread({report, reportAction, isHovered, onSecondaryInteraction, isEditingInline, isActive}: ReportActionItemThreadProps) {
    const styles = useThemeStyles();
    const {accountID: currentUserAccountID} = useCurrentUserPersonalDetails();
    const {translate, datetimeToCalendarTime} = useLocalize();
    const [childReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportAction.childReportID}`);
    const [delegateByActorAccountID] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${reportAction.childReportID}`, {canBeMissing: true, selector: getDelegateByActorAccountID});
    const [introSelected] = useOnyx(ONYXKEYS.NVP_INTRO_SELECTED);
    const [isSelfTourViewed] = useOnyx(ONYXKEYS.NVP_ONBOARDING, {selector: hasSeenTourSelector});
    const [betas] = useOnyx(ONYXKEYS.BETAS);
    const personalDetails = usePersonalDetails();

    const numberOfReplies = reportAction.childVisibleActionCount ?? 0;
    const accountIDs = getThreadSummaryAccountIDs(reportAction, delegateByActorAccountID);
    const mostRecentReply = `${reportAction.childLastVisibleActionCreated}`;

    const numberOfRepliesText = numberOfReplies > CONST.MAX_THREAD_REPLIES_PREVIEW ? `${CONST.MAX_THREAD_REPLIES_PREVIEW}+` : `${numberOfReplies}`;
    const replyText = numberOfReplies === 1 ? translate('threads.reply') : translate('threads.replies');

    const timeStamp = datetimeToCalendarTime(mostRecentReply, false);
    const wrapperStyle = isEditingInline ? styles.chatItemReactionsDraftRight : {};

    return (
        <View style={wrapperStyle}>
            <View style={[styles.chatItemMessage]}>
                <PressableWithSecondaryInteraction
                    onPress={() => {
                        const participantsPersonalDetails = getParticipantsPersonalDetails([currentUserAccountID, Number(reportAction.actorAccountID)], personalDetails);
                        navigateToAndOpenChildReport(childReport, reportAction, report, currentUserAccountID, introSelected, betas, participantsPersonalDetails, isSelfTourViewed);
                    }}
                    role={CONST.ROLE.BUTTON}
                    accessibilityLabel={`${numberOfReplies} ${replyText}`}
                    onSecondaryInteraction={onSecondaryInteraction}
                    sentryLabel={CONST.SENTRY_LABEL.REPORT.REPORT_ACTION_ITEM_THREAD}
                >
                    <View style={[styles.flexRow, styles.alignItemsCenter, styles.mt2]}>
                        <MultiAccountAvatar
                            size={CONST.AVATAR_SIZE.SMALL}
                            accountIDs={accountIDs}
                            horizontalOptions={{
                                isHovered,
                                isActive,
                            }}
                            sortBy={[CONST.REPORT_ACTION_AVATARS.SORT_BY.NAME]}
                            isInReportAction
                        />
                        <View style={[styles.flex1, styles.flexRow, styles.lh140Percent, styles.alignItemsEnd]}>
                            <Text
                                style={[styles.link, styles.ml2, styles.h4, styles.noWrap, styles.userSelectNone]}
                                dataSet={{[CONST.SELECTION_SCRAPER_HIDDEN_ELEMENT]: true}}
                            >
                                {`${numberOfRepliesText} ${replyText}`}
                            </Text>
                            <Text
                                numberOfLines={1}
                                style={[styles.ml2, styles.textMicroSupporting, styles.flex1, styles.userSelectNone]}
                                dataSet={{[CONST.SELECTION_SCRAPER_HIDDEN_ELEMENT]: true}}
                            >
                                {timeStamp}
                            </Text>
                        </View>
                    </View>
                </PressableWithSecondaryInteraction>
            </View>
        </View>
    );
}

export default ReportActionItemThread;
