import {useCallback, useMemo} from 'react';
import type {ValueOf} from 'type-fest';
import type {SearchQueryItem} from '@components/Search/SearchList/ListItem/SearchQueryListItem';
import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import useSearchTypeMenuSections from '@hooks/useSearchTypeMenuSections';
import {buildCannedSearchQuery} from '@libs/SearchQueryUtils';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';
import type {Route} from '@src/ROUTES';
import type IconAsset from '@src/types/utils/IconAsset';

type NavigationCategory = ValueOf<typeof CONST.SEARCH.NAVIGATION_SUGGESTION_CATEGORY>;

type NavigationCatalogEntry = {
    /** Stable key for the list row */
    key: string;

    /** Destination display name, e.g. "Spend" or "Top spenders" */
    title: string;

    /** Left icon for the row */
    icon: IconAsset;

    /** Category, used both for ranking order and the Spend stale-header fix */
    navCategory: NavigationCategory;

    /** Route to navigate to (top-level/account/workspace rows) */
    route?: Route;

    /** Canned search query for Spend rows — turned into a SEARCH_ROOT route at press time */
    searchQuery?: string;

    /** Optional right-side icon (the owning tab/area icon) */
    rightIcon?: IconAsset;

    /** Optional right-side label (the owning tab/area name) */
    rightText?: string;
};

// Ranking weights: a full prefix beats a word-boundary prefix beats a loose substring.
const SCORE_FULL_PREFIX = 3;
const SCORE_WORD_PREFIX = 2;
const SCORE_SUBSTRING = 1;
const SCORE_INTENT_ONLY = 1;

const CATEGORY_ORDER: Record<NavigationCategory, number> = {
    [CONST.SEARCH.NAVIGATION_SUGGESTION_CATEGORY.TOP_LEVEL]: 0,
    [CONST.SEARCH.NAVIGATION_SUGGESTION_CATEGORY.SPEND]: 1,
    [CONST.SEARCH.NAVIGATION_SUGGESTION_CATEGORY.ACCOUNT]: 2,
    [CONST.SEARCH.NAVIGATION_SUGGESTION_CATEGORY.WORKSPACE]: 3,
    [CONST.SEARCH.NAVIGATION_SUGGESTION_CATEGORY.CREATE]: 4,
};

// "go" / "go to" optionally followed by the destination the user is looking for.
// The trailing \b keeps "gold"/"got" from being mistaken for a navigation intent.
const NAVIGATION_INTENT_REGEX = /^go(?:\s+to)?\b\s*(.*)$/;

const normalize = (value: string): string =>
    value
        .toLowerCase()
        .normalize('NFD')
        .replaceAll(/\p{Diacritic}/gu, '')
        .trim();

function scoreEntry(normalizedTitle: string, needle: string): number {
    if (!needle) {
        return SCORE_INTENT_ONLY;
    }
    if (normalizedTitle.startsWith(needle)) {
        return SCORE_FULL_PREFIX;
    }
    if (normalizedTitle.split(/\s+/).some((word) => word.startsWith(needle))) {
        return SCORE_WORD_PREFIX;
    }
    if (normalizedTitle.includes(needle)) {
        return SCORE_SUBSTRING;
    }
    return 0;
}

/**
 * Builds the in-app navigation catalog from the existing menu sources and returns a stable
 * `getNavigationSuggestions(query)` that filters + ranks it for the Search Router. The catalog is
 * rebuilt only when its real inputs change (policies, betas, …), not on every keystroke.
 */
function useNavigationSuggestions(): (query: string) => SearchQueryItem[] {
    const {translate} = useLocalize();
    const {typeMenuSections} = useSearchTypeMenuSections();
    const icons = useMemoizedLazyExpensifyIcons([
        'Home',
        'Buildings',
        'Gear',
        'MoneyBag',
        'Basket',
        'CalendarSolid',
        'Receipt',
        'CreditCard',
        'MoneyHourglass',
        'CreditCardHourglass',
        'Bank',
        'User',
        'Folder',
        'Document',
        'Pencil',
        'ThumbsUp',
        'CheckCircle',
    ]);

    const catalog = useMemo<NavigationCatalogEntry[]>(() => {
        const entries: NavigationCatalogEntry[] = [];

        // Top-level destinations (no right-side decoration per the spec).
        entries.push(
            {key: 'nav-home', title: translate('common.home'), icon: icons.Home, navCategory: CONST.SEARCH.NAVIGATION_SUGGESTION_CATEGORY.TOP_LEVEL, route: ROUTES.HOME as Route},
            {key: 'nav-inbox', title: translate('common.inbox'), icon: icons.Home, navCategory: CONST.SEARCH.NAVIGATION_SUGGESTION_CATEGORY.TOP_LEVEL, route: ROUTES.HOME as Route},
            {
                key: 'nav-spend',
                title: translate('common.spend'),
                icon: icons.MoneyBag,
                navCategory: CONST.SEARCH.NAVIGATION_SUGGESTION_CATEGORY.SPEND,
                searchQuery: buildCannedSearchQuery(),
            },
            {
                key: 'nav-workspaces',
                title: translate('common.workspaces'),
                icon: icons.Buildings,
                navCategory: CONST.SEARCH.NAVIGATION_SUGGESTION_CATEGORY.TOP_LEVEL,
                route: ROUTES.WORKSPACES_LIST.getRoute(),
            },
            {key: 'nav-account', title: translate('common.settings'), icon: icons.Gear, navCategory: CONST.SEARCH.NAVIGATION_SUGGESTION_CATEGORY.TOP_LEVEL, route: ROUTES.SETTINGS as Route},
        );

        // Spend tabs, derived from the same source the Spend menu renders, so we only ever surface
        // tabs the user can actually see.
        for (const section of typeMenuSections) {
            const sectionLabel = translate(section.translationPath);
            for (const item of section.menuItems) {
                entries.push({
                    key: `nav-spend-${item.key}`,
                    title: translate(item.translationPath),
                    icon: icons[item.icon],
                    navCategory: CONST.SEARCH.NAVIGATION_SUGGESTION_CATEGORY.SPEND,
                    searchQuery: item.searchQuery,
                    rightIcon: icons.MoneyBag,
                    rightText: sectionLabel,
                });
            }
        }

        return entries;
    }, [translate, typeMenuSections, icons]);

    return useCallback(
        (query: string): SearchQueryItem[] => {
            const normalizedQuery = normalize(query);
            if (!normalizedQuery) {
                return [];
            }

            const intentMatch = normalizedQuery.match(NAVIGATION_INTENT_REGEX);
            const isNavigationIntent = !!intentMatch;
            const needle = isNavigationIntent ? (intentMatch?.[1] ?? '').trim() : normalizedQuery;

            // Direct queries must clear the min-length gate; an explicit "go" / "go to" intent bypasses it
            // (so the 2-char "go" still works without re-opening the 1–2 char problem).
            if (!isNavigationIntent && needle.length <= CONST.SEARCH.NAVIGATION_SUGGESTION_MIN_QUERY_LENGTH) {
                return [];
            }

            const scored = catalog
                .map((entry) => ({entry, score: scoreEntry(normalize(entry.title), needle)}))
                .filter(({score}) => score > 0)
                .sort((a, b) => b.score - a.score || CATEGORY_ORDER[a.entry.navCategory] - CATEGORY_ORDER[b.entry.navCategory])
                .slice(0, CONST.SEARCH.NAVIGATION_SUGGESTION_MAX_RESULTS);

            return scored.map(({entry}) => ({
                text: translate('search.goTo', entry.title),
                singleIcon: entry.icon,
                searchItemType: CONST.SEARCH.SEARCH_ROUTER_ITEM_TYPE.NAVIGATE,
                navCategory: entry.navCategory,
                route: entry.route,
                searchQuery: entry.searchQuery,
                rightIcon: entry.rightIcon,
                rightText: entry.rightText,
                keyForList: entry.key,
            }));
        },
        [catalog, translate],
    );
}

export default useNavigationSuggestions;
