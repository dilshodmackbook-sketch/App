import React from 'react';
import {View} from 'react-native';
import type {ValueOf} from 'type-fest';
import Avatar from '@components/Avatar';
import Icon from '@components/Icon';
import BaseListItem from '@components/SelectionList/ListItem/BaseListItem';
import type {ListItem, ListItemFocusEventHandler} from '@components/SelectionList/ListItem/types';
import Text from '@components/Text';
import TextWithTooltip from '@components/TextWithTooltip';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import type {OptionData} from '@libs/ReportUtils';
import CONST from '@src/CONST';
import type {Route} from '@src/ROUTES';
import type {Icon as IconType} from '@src/types/onyx/OnyxCommon';
import type IconAsset from '@src/types/utils/IconAsset';

type SearchQueryItem = ListItem & {
    singleIcon?: IconAsset;
    /** Whether to apply the theme fill color to the icon. Set to false for multi-colored icons like avatars. Defaults to true. */
    shouldIconApplyFill?: boolean;
    searchItemType?: ValueOf<typeof CONST.SEARCH.SEARCH_ROUTER_ITEM_TYPE>;
    searchQuery?: string;
    autocompleteID?: string;
    roomType?: ValueOf<typeof CONST.SEARCH.DATA_TYPES>;
    mapKey?: string;

    /** Navigation suggestion: route to navigate to when pressed (omitted for create-menu rows that run an action). */
    route?: Route;

    /** Navigation suggestion category, used for ranking and for the Spend stale-header fix. */
    navCategory?: ValueOf<typeof CONST.SEARCH.NAVIGATION_SUGGESTION_CATEGORY>;

    /** Navigation suggestion: optional right-side decoration (tab label for Spend/Account, workspace name, etc.). */
    rightText?: string;

    /** Navigation suggestion: optional right-side icon (e.g. the Spend/Account tab icon). */
    rightIcon?: IconAsset;

    /** Navigation suggestion: optional right-side avatar (e.g. the workspace avatar). */
    rightAvatar?: IconType;
};

type SearchQueryListItemProps = {
    item: SearchQueryItem;
    isFocused?: boolean;
    showTooltip: boolean;
    onSelectRow: (item: SearchQueryItem) => void;
    onFocus?: ListItemFocusEventHandler;
    shouldSyncFocus?: boolean;
    shouldDisableHoverStyle?: boolean;
};

function isSearchQueryItem(item: OptionData | SearchQueryItem): item is SearchQueryItem {
    return 'searchItemType' in item;
}

/**
 * A row with an optional icon, title, and subtitle used in the search router for autocomplete
 * suggestions, saved searches, and recent queries.
 */
function SearchQueryListItem({item, isFocused, showTooltip, onSelectRow, onFocus, shouldSyncFocus, shouldDisableHoverStyle}: SearchQueryListItemProps) {
    const styles = useThemeStyles();
    const theme = useTheme();

    return (
        <BaseListItem
            item={item}
            pressableStyle={[[styles.searchQueryListItemStyle, item.isSelected && styles.activeComponentBG, item.cursorStyle]]}
            wrapperStyle={[styles.flexRow, styles.flex1, styles.justifyContentBetween, styles.userSelectNone, styles.alignItemsCenter]}
            isFocused={isFocused}
            onSelectRow={onSelectRow}
            keyForList={item.keyForList}
            onFocus={onFocus}
            hoverStyle={item.isSelected && styles.activeComponentBG}
            shouldSyncFocus={shouldSyncFocus}
            showTooltip={showTooltip}
            shouldDisableHoverStyle={shouldDisableHoverStyle}
            shouldHighlightSelectedItem
        >
            <>
                {!!item.singleIcon && (
                    <Icon
                        src={item.singleIcon}
                        fill={item.shouldIconApplyFill !== false ? theme.icon : undefined}
                        additionalStyles={styles.mr3}
                        medium
                    />
                )}
                <View style={[styles.flex1, styles.flexColumn, styles.justifyContentCenter, styles.alignItemsStretch]}>
                    <TextWithTooltip
                        shouldShowTooltip={showTooltip ?? false}
                        text={item.text ?? ''}
                        style={[
                            styles.optionDisplayName,
                            isFocused ? styles.sidebarLinkActiveText : styles.sidebarLinkText,
                            styles.sidebarLinkTextBold,
                            styles.pre,
                            item.alternateText ? styles.mb1 : null,
                            styles.justifyContentCenter,
                        ]}
                    />
                    {!!item.alternateText && (
                        <TextWithTooltip
                            shouldShowTooltip={showTooltip ?? false}
                            text={item.alternateText}
                            style={[styles.textLabelSupporting, styles.lh16, styles.pre]}
                        />
                    )}
                </View>
                {(!!item.rightText || !!item.rightIcon || !!item.rightAvatar) && (
                    <View style={[styles.flexRow, styles.alignItemsCenter, styles.ml2]}>
                        {!!item.rightAvatar && (
                            <Avatar
                                source={item.rightAvatar.source}
                                name={item.rightAvatar.name}
                                type={item.rightAvatar.type}
                                size={CONST.AVATAR_SIZE.SMALL}
                                avatarID={item.rightAvatar.id}
                            />
                        )}
                        {!!item.rightIcon && !item.rightAvatar && (
                            <Icon
                                src={item.rightIcon}
                                fill={theme.icon}
                                small
                            />
                        )}
                        {!!item.rightText && <Text style={[styles.textLabelSupporting, styles.ml1]}>{item.rightText}</Text>}
                    </View>
                )}
            </>
        </BaseListItem>
    );
}

export default SearchQueryListItem;
export {isSearchQueryItem};
export type {SearchQueryItem, SearchQueryListItemProps};
