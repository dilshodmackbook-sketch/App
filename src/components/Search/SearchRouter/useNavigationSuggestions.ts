import {useCallback, useMemo, useState} from 'react';
import type {ValueOf} from 'type-fest';
import type {SearchQueryItem} from '@components/Search/SearchList/ListItem/SearchQueryListItem';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import useSearchTypeMenuSections from '@hooks/useSearchTypeMenuSections';
import {startMoneyRequest} from '@libs/actions/IOU/MoneyRequest';
import {startNewChat} from '@libs/actions/Report';
import interceptAnonymousUser from '@libs/interceptAnonymousUser';
import Navigation from '@libs/Navigation/Navigation';
import {canMemberRead, getActivePolicies, isGroupPolicy, isPendingDeletePolicy} from '@libs/PolicyUtils';
import {generateReportID, getDefaultWorkspaceAvatar} from '@libs/ReportUtils';
import {buildCannedSearchQuery} from '@libs/SearchQueryUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {Route} from '@src/ROUTES';
import {validTransactionDraftIDsSelector} from '@src/selectors/TransactionDraft';
import type {Icon as IconType} from '@src/types/onyx/OnyxCommon';
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

    /** Action to run for create-menu rows (open a flow) instead of navigating to a route */
    onSelectAction?: () => void;

    /** Optional right-side icon (the owning tab/area icon) */
    rightIcon?: IconAsset;

    /** Optional right-side label (the owning tab/area name, or the workspace name) */
    rightText?: string;

    /** Optional right-side avatar (the workspace avatar) */
    rightAvatar?: IconType;
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
    const currentUserLogin = useCurrentUserPersonalDetails().login;
    const [policies] = useOnyx(ONYXKEYS.COLLECTION.POLICY);
    const [draftTransactionIDs] = useOnyx(ONYXKEYS.COLLECTION.TRANSACTION_DRAFT, {selector: validTransactionDraftIDsSelector});
    // One report ID for the lifetime of the router, mirroring the FAB's create flow.
    const [createExpenseReportID] = useState(() => generateReportID());
    const icons = useMemoizedLazyExpensifyIcons([
        'Home',
        'Buildings',
        'Building',
        'Gear',
        'MoneyBag',
        'Basket',
        'Receipt',
        'CalendarSolid',
        'CreditCard',
        'CreditCardHourglass',
        'MoneyHourglass',
        'ExpensifyCard',
        'CheckCircle',
        'ThumbsUp',
        'Bank',
        'User',
        'Users',
        'Folder',
        'Document',
        'Pencil',
        'Wallet',
        'Lock',
        'Bolt',
        'Info',
        'Lightbulb',
        'QuestionMark',
        'Hashtag',
        'Tag',
        'Coins',
        'Car',
        'Sync',
        'Feed',
        'Workflows',
        'InvoiceGeneric',
        'ChatBubble',
        'NewWorkspace',
    ]);

    const catalog = useMemo<NavigationCatalogEntry[]>(() => {
        const TOP_LEVEL = CONST.SEARCH.NAVIGATION_SUGGESTION_CATEGORY.TOP_LEVEL;
        const SPEND = CONST.SEARCH.NAVIGATION_SUGGESTION_CATEGORY.SPEND;
        const ACCOUNT = CONST.SEARCH.NAVIGATION_SUGGESTION_CATEGORY.ACCOUNT;
        const WORKSPACE = CONST.SEARCH.NAVIGATION_SUGGESTION_CATEGORY.WORKSPACE;
        const CREATE = CONST.SEARCH.NAVIGATION_SUGGESTION_CATEGORY.CREATE;
        const entries: NavigationCatalogEntry[] = [];

        // Top-level destinations (no right-side decoration per the spec).
        entries.push(
            {key: 'nav-home', title: translate('common.home'), icon: icons.Home, navCategory: TOP_LEVEL, route: ROUTES.HOME as Route},
            {key: 'nav-inbox', title: translate('common.inbox'), icon: icons.Home, navCategory: TOP_LEVEL, route: ROUTES.HOME as Route},
            {key: 'nav-spend', title: translate('common.spend'), icon: icons.MoneyBag, navCategory: SPEND, searchQuery: buildCannedSearchQuery()},
            {key: 'nav-workspaces', title: translate('common.workspaces'), icon: icons.Buildings, navCategory: TOP_LEVEL, route: ROUTES.WORKSPACES_LIST.getRoute()},
            {key: 'nav-account', title: translate('common.settings'), icon: icons.Gear, navCategory: TOP_LEVEL, route: ROUTES.SETTINGS as Route},
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
                    navCategory: SPEND,
                    searchQuery: item.searchQuery,
                    rightIcon: icons.MoneyBag,
                    rightText: sectionLabel,
                });
            }
        }

        // Account pages, mirroring InitialSettingsPage. Excludes What's new, Sign out, and Save the world
        // per the spec. Right-side decoration is the Account tab icon + label.
        const accountLabel = translate('initialSettingsPage.account');
        const accountPages: Array<{key: string; title: string; icon: IconAsset; route: Route}> = [
            {key: 'nav-acc-profile', title: translate('common.profile'), icon: icons.User, route: ROUTES.SETTINGS_PROFILE.getRoute()},
            {key: 'nav-acc-wallet', title: translate('common.wallet'), icon: icons.Wallet, route: ROUTES.SETTINGS_WALLET as Route},
            {key: 'nav-acc-preferences', title: translate('common.preferences'), icon: icons.Gear, route: ROUTES.SETTINGS_PREFERENCES as Route},
            {key: 'nav-acc-security', title: translate('initialSettingsPage.security'), icon: icons.Lock, route: ROUTES.SETTINGS_SECURITY as Route},
            {key: 'nav-acc-copilot', title: translate('delegate.copilot'), icon: icons.Users, route: ROUTES.SETTINGS_COPILOT as Route},
            {key: 'nav-acc-rules', title: translate('expenseRulesPage.title'), icon: icons.Bolt, route: ROUTES.SETTINGS_RULES as Route},
            {key: 'nav-acc-about', title: translate('initialSettingsPage.about'), icon: icons.Info, route: ROUTES.SETTINGS_ABOUT as Route},
            {key: 'nav-acc-troubleshoot', title: translate('initialSettingsPage.aboutPage.troubleshoot'), icon: icons.Lightbulb, route: ROUTES.SETTINGS_TROUBLESHOOT as Route},
            {key: 'nav-acc-help', title: translate('initialSettingsPage.help'), icon: icons.QuestionMark, route: ROUTES.SETTINGS_HELP as Route},
        ];
        for (const page of accountPages) {
            entries.push({key: page.key, title: page.title, icon: page.icon, navCategory: ACCOUNT, route: page.route, rightIcon: icons.Gear, rightText: accountLabel});
        }

        // Per-workspace pages, derived from the policies the user belongs to, gated exactly like
        // WorkspaceInitialPage (group policy + read permission + feature-enabled), so we only ever
        // surface pages the user can actually open. Right-side decoration is the workspace avatar + name.
        const visiblePolicies = getActivePolicies(policies, currentUserLogin ?? undefined).filter((policy) => !isPendingDeletePolicy(policy));
        for (const policy of visiblePolicies) {
            const policyID = policy.id;
            const workspaceName = policy.name ?? '';
            const avatar: IconType = {
                source: policy.avatarURL ? policy.avatarURL : getDefaultWorkspaceAvatar(workspaceName),
                name: workspaceName,
                type: CONST.ICON_TYPE_WORKSPACE,
                id: policyID,
            };
            const pushWorkspaceRow = (suffix: string, title: string, icon: IconAsset, route: Route) =>
                entries.push({key: `nav-ws-${policyID}-${suffix}`, title, icon, navCategory: WORKSPACE, route, rightAvatar: avatar, rightText: workspaceName});

            // Overview and Members are always available.
            pushWorkspaceRow('overview', translate('workspace.common.profile'), icons.Building, ROUTES.WORKSPACE_OVERVIEW.getRoute(policyID));
            pushWorkspaceRow('members', translate('workspace.common.members'), icons.Users, ROUTES.WORKSPACE_MEMBERS.getRoute(policyID));

            if (!isGroupPolicy(policy)) {
                continue;
            }

            const POLICY_FEATURE = CONST.POLICY.POLICY_FEATURE;
            const protectedPages: Array<{suffix: string; feature: ValueOf<typeof POLICY_FEATURE>; isEnabled: boolean; title: string; icon: IconAsset; route: Route}> = [
                {
                    suffix: 'categories',
                    feature: POLICY_FEATURE.CATEGORIES,
                    isEnabled: !!policy.areCategoriesEnabled,
                    title: translate('workspace.common.categories'),
                    icon: icons.Folder,
                    route: ROUTES.WORKSPACE_CATEGORIES.getRoute(policyID),
                },
                {
                    suffix: 'tags',
                    feature: POLICY_FEATURE.TAGS,
                    isEnabled: !!policy.areTagsEnabled,
                    title: translate('workspace.common.tags'),
                    icon: icons.Tag,
                    route: ROUTES.WORKSPACE_TAGS.getRoute(policyID),
                },
                {
                    suffix: 'taxes',
                    feature: POLICY_FEATURE.TAXES,
                    isEnabled: !!policy.tax?.trackingEnabled,
                    title: translate('workspace.common.taxes'),
                    icon: icons.Coins,
                    route: ROUTES.WORKSPACE_TAXES.getRoute(policyID),
                },
                {
                    suffix: 'workflows',
                    feature: POLICY_FEATURE.WORKFLOWS,
                    isEnabled: !!policy.areWorkflowsEnabled,
                    title: translate('workspace.common.workflows'),
                    icon: icons.Workflows,
                    route: ROUTES.WORKSPACE_WORKFLOWS.getRoute(policyID),
                },
                {
                    suffix: 'rules',
                    feature: POLICY_FEATURE.RULES,
                    isEnabled: !!policy.areRulesEnabled,
                    title: translate('workspace.common.rules'),
                    icon: icons.Feed,
                    route: ROUTES.WORKSPACE_RULES.getRoute(policyID),
                },
                {
                    suffix: 'distance-rates',
                    feature: POLICY_FEATURE.DISTANCE_RATES,
                    isEnabled: !!policy.areDistanceRatesEnabled,
                    title: translate('workspace.common.distanceRates'),
                    icon: icons.Car,
                    route: ROUTES.WORKSPACE_DISTANCE_RATES.getRoute(policyID),
                },
                {
                    suffix: 'per-diem',
                    feature: POLICY_FEATURE.PER_DIEM,
                    isEnabled: !!policy.arePerDiemRatesEnabled,
                    title: translate('common.perDiem'),
                    icon: icons.CalendarSolid,
                    route: ROUTES.WORKSPACE_PER_DIEM.getRoute(policyID),
                },
                {
                    suffix: 'expensify-card',
                    feature: POLICY_FEATURE.EXPENSIFY_CARD,
                    isEnabled: !!policy.areExpensifyCardsEnabled,
                    title: translate('workspace.common.expensifyCard'),
                    icon: icons.ExpensifyCard,
                    route: ROUTES.WORKSPACE_EXPENSIFY_CARD.getRoute(policyID),
                },
                {
                    suffix: 'company-cards',
                    feature: POLICY_FEATURE.COMPANY_CARDS,
                    isEnabled: !!policy.areCompanyCardsEnabled,
                    title: translate('workspace.common.companyCards'),
                    icon: icons.CreditCard,
                    route: ROUTES.WORKSPACE_COMPANY_CARDS.getRoute(policyID),
                },
                {
                    suffix: 'report-fields',
                    feature: POLICY_FEATURE.REPORT_FIELDS,
                    isEnabled: !!policy.areReportFieldsEnabled,
                    title: translate('common.reports'),
                    icon: icons.Document,
                    route: ROUTES.WORKSPACE_REPORTS.getRoute(policyID),
                },
                {
                    suffix: 'accounting',
                    feature: POLICY_FEATURE.ACCOUNTING,
                    isEnabled: !!policy.areConnectionsEnabled,
                    title: translate('workspace.common.accounting'),
                    icon: icons.Sync,
                    route: ROUTES.POLICY_ACCOUNTING.getRoute(policyID),
                },
                {
                    suffix: 'invoices',
                    feature: POLICY_FEATURE.MORE_FEATURES,
                    isEnabled: !!policy.areInvoicesEnabled,
                    title: translate('workspace.common.invoices'),
                    icon: icons.InvoiceGeneric,
                    route: ROUTES.WORKSPACE_INVOICES.getRoute(policyID),
                },
                {
                    suffix: 'more-features',
                    feature: POLICY_FEATURE.MORE_FEATURES,
                    isEnabled: true,
                    title: translate('workspace.common.moreFeatures'),
                    icon: icons.Gear,
                    route: ROUTES.WORKSPACE_MORE_FEATURES.getRoute(policyID),
                },
            ];
            for (const page of protectedPages) {
                if (!page.isEnabled || !canMemberRead(policy, currentUserLogin ?? '', page.feature)) {
                    continue;
                }
                pushWorkspaceRow(page.suffix, page.title, page.icon, page.route);
            }
        }

        // Create-menu actions (the FAB items), excluding the dynamic quick action per the spec.
        // These run an action on press; per the spec they keep their plain menu label (no "Go to" prefix)
        // and have no right-side decoration.
        entries.push(
            {
                key: 'nav-create-expense',
                title: translate('iou.createExpense'),
                icon: icons.Receipt,
                navCategory: CREATE,
                onSelectAction: () =>
                    interceptAnonymousUser(() => startMoneyRequest(CONST.IOU.TYPE.CREATE, createExpenseReportID, draftTransactionIDs, undefined, undefined, undefined, true)),
            },
            {
                key: 'nav-create-chat',
                title: translate('sidebarScreen.fabNewChat'),
                icon: icons.ChatBubble,
                navCategory: CREATE,
                onSelectAction: () => interceptAnonymousUser(startNewChat),
            },
            {
                key: 'nav-create-workspace',
                title: translate('workspace.new.newWorkspace'),
                icon: icons.NewWorkspace,
                navCategory: CREATE,
                onSelectAction: () => interceptAnonymousUser(() => Navigation.navigate(ROUTES.WORKSPACE_CONFIRMATION.getRoute(Navigation.getActiveRoute()))),
            },
        );

        return entries;
    }, [translate, typeMenuSections, icons, policies, currentUserLogin, draftTransactionIDs, createExpenseReportID]);

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
                // Create rows keep their menu label; everything else reads as "Go to {destination}".
                text: entry.navCategory === CONST.SEARCH.NAVIGATION_SUGGESTION_CATEGORY.CREATE ? entry.title : translate('search.goTo', entry.title),
                singleIcon: entry.icon,
                searchItemType: CONST.SEARCH.SEARCH_ROUTER_ITEM_TYPE.NAVIGATE,
                navCategory: entry.navCategory,
                route: entry.route,
                searchQuery: entry.searchQuery,
                onSelectAction: entry.onSelectAction,
                rightIcon: entry.rightIcon,
                rightText: entry.rightText,
                rightAvatar: entry.rightAvatar,
                keyForList: entry.key,
            }));
        },
        [catalog, translate],
    );
}

export default useNavigationSuggestions;
