import {act, render, renderHook} from '@testing-library/react-native';

import MoneyRequestReportNavigation from '@components/MoneyRequestReportView/MoneyRequestReportNavigation';
import type PrevNextButtons from '@components/PrevNextButtons';
import {useSearchResultsContext} from '@components/Search/SearchContext';

import useFilterPendingDeleteReports from '@hooks/useFilterPendingDeleteReports';

import Navigation from '@navigation/Navigation';

import {search} from '@userActions/Search';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';

import React, {useState} from 'react';

/**
 * These tests verify the source-selection and cache logic of MoneyRequestReportNavigation.
 * The first suites exercise the same logic the component's stable content child runs via a mirrored
 * hook; the pagination suite renders the real component against a fake Onyx store, because the
 * regression it guards (#101453) lives in the interplay of the component's list selection, its
 * pagination request and the persisted search params.
 */

type SearchSectionsResult = {allReports: Array<string | undefined>; isSearchLoading: boolean; lastSearchQuery: undefined};

type PrevNextButtonsProps = React.ComponentProps<typeof PrevNextButtons>;

let mockSortedReportIDs: ReadonlyArray<string | undefined> = CONST.EMPTY_ARRAY;

jest.mock('@components/Search/SearchContext', () => ({
    useSearchResultsContext: () => ({sortedReportIDs: mockSortedReportIDs}),
}));

const mockUseOnyx = jest.fn();
jest.mock('@hooks/useOnyx', () => ({
    __esModule: true,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    default: (...args: unknown[]) => mockUseOnyx(...args),
}));

const mockUseSearchSections = jest.fn<SearchSectionsResult, []>();
jest.mock('@hooks/useSearchSections', () => ({
    __esModule: true,
    default: () => mockUseSearchSections(),
}));

jest.mock('@hooks/useFilterPendingDeleteReports', () => ({
    __esModule: true,
    default: (ids: ReadonlyArray<string | undefined>) => ids.filter(Boolean),
}));

jest.mock('@hooks/useThemeStyles', () => ({
    __esModule: true,
    default: () => ({}),
}));

let mockPrevNextButtonsProps: PrevNextButtonsProps | undefined;
jest.mock('@components/PrevNextButtons', () => ({
    __esModule: true,
    default: (props: PrevNextButtonsProps) => {
        mockPrevNextButtonsProps = props;
        return null;
    },
}));

jest.mock('@libs/telemetry/activeSpans', () => ({
    startSpan: jest.fn(),
}));

jest.mock('@navigation/Navigation', () => ({
    __esModule: true,
    default: {setParams: jest.fn()},
}));

jest.mock('@userActions/Search', () => ({
    search: jest.fn(),
}));

const mockSaveLastSearchParams = jest.fn();
jest.mock('@userActions/ReportNavigation', () => ({
    saveLastSearchParams: (...args: unknown[]) => {
        mockSaveLastSearchParams(...args);
    },
}));

const isSameReportList = (a: Array<string | undefined>, b: Array<string | undefined> | null): boolean => {
    if (a === b) {
        return true;
    }
    if (b === null || a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a.at(i) !== b.at(i)) {
            return false;
        }
    }
    return true;
};

/**
 * Mirrors the source-selection + lastValidReports cache that lives in the single, stable
 * MoneyRequestReportNavigationContent instance. That component selects the context list or the
 * standalone list (the latter lifted from a child that mounts the heavy useSearchSections
 * subscriptions only on the slow path) as a value, so the cache survives an isSearchLoading toggle
 * instead of being reset by a component-subtree swap. The context list is dropped in favor of a
 * longer standalone list once the persisted offset shows the arrows have paginated past it.
 */
function useNavigationSource(reportID: string | undefined, persistedOffset = 0) {
    const {sortedReportIDs} = useSearchResultsContext();
    const contextReports = useFilterPendingDeleteReports(sortedReportIDs);
    const {allReports: standaloneReports, isSearchLoading} = mockUseSearchSections();

    const hasPaginatedPastContext = contextReports.length > 0 && persistedOffset >= contextReports.length;
    const shouldUseContextReports = contextReports.length > 0 && !isSearchLoading && !(hasPaginatedPastContext && standaloneReports.length > contextReports.length);
    const allReports = shouldUseContextReports ? contextReports : standaloneReports;
    const liveCurrentIndex = allReports.indexOf(reportID);

    const [lastValidReports, setLastValidReports] = useState<Array<string | undefined> | null>(null);
    if (liveCurrentIndex !== -1 && !isSameReportList(allReports, lastValidReports)) {
        setLastValidReports(allReports);
    }
    const effectiveAllReports = liveCurrentIndex === -1 && lastValidReports ? lastValidReports : allReports;

    return {source: shouldUseContextReports ? 'fast' : 'full', allReports, effectiveAllReports};
}

const HASH = 12345;
const SNAPSHOT_KEY = `${ONYXKEYS.COLLECTION.SNAPSHOT}${HASH}`;

type FakeStore = Record<string, unknown>;

/** Builds report IDs "1".."count" plus the snapshot data keys the outer mount guard scans. */
function buildReportIDs(count: number): string[] {
    return Array.from({length: count}, (_, index) => String(index + 1));
}

function buildSnapshotData(count: number): Record<string, unknown> {
    return Object.fromEntries(buildReportIDs(count).map((id) => [`${ONYXKEYS.COLLECTION.REPORT}${id}`, {reportID: id}]));
}

describe('MoneyRequestReportNavigation', () => {
    beforeEach(() => {
        mockSortedReportIDs = CONST.EMPTY_ARRAY;
        mockUseOnyx.mockReturnValue([undefined]);
        mockUseSearchSections.mockClear();
        mockUseSearchSections.mockReturnValue({allReports: [], isSearchLoading: false, lastSearchQuery: undefined});
    });

    describe('path selection', () => {
        it('uses fast path (context list) when context has IDs and not loading', () => {
            mockSortedReportIDs = ['1', '2'];
            mockUseSearchSections.mockReturnValue({allReports: ['1', '2', '3'], isSearchLoading: false, lastSearchQuery: undefined});

            const {result} = renderHook(() => useNavigationSource('1'));

            expect(result.current.source).toBe('fast');
            expect(result.current.allReports).toEqual(['1', '2']);
        });

        it('uses full path (standalone list) when context is empty', () => {
            mockSortedReportIDs = CONST.EMPTY_ARRAY;
            mockUseSearchSections.mockReturnValue({allReports: ['1', '2'], isSearchLoading: false, lastSearchQuery: undefined});

            const {result} = renderHook(() => useNavigationSource('1'));

            expect(result.current.source).toBe('full');
            expect(result.current.allReports).toEqual(['1', '2']);
        });

        it('uses full path (standalone list) when search is loading (pagination)', () => {
            mockSortedReportIDs = ['1', '2'];
            mockUseSearchSections.mockReturnValue({allReports: ['1', '2', '3'], isSearchLoading: true, lastSearchQuery: undefined});

            const {result} = renderHook(() => useNavigationSource('1'));

            expect(result.current.source).toBe('full');
            expect(result.current.allReports).toEqual(['1', '2', '3']);
        });

        it('uses the longer standalone list once the arrows have paginated past the context list', () => {
            // Given a context list frozen at one page while the persisted offset shows the arrows already
            // requested the page beyond it, and the snapshot-backed list has grown past the context list.
            mockSortedReportIDs = buildReportIDs(50);
            mockUseSearchSections.mockReturnValue({allReports: buildReportIDs(100), isSearchLoading: false, lastSearchQuery: undefined});

            // When selecting the navigation source with that persisted offset.
            const {result} = renderHook(() => useNavigationSource('50', 50));

            // Then the grown snapshot-backed list wins, because the frozen context list is provably
            // incomplete: preferring it is what capped the carousel at "50 of 50" (#101453).
            expect(result.current.source).toBe('full');
            expect(result.current.allReports).toEqual(buildReportIDs(100));
        });
    });

    describe('cache survives the isSearchLoading toggle', () => {
        it('keeps the last list that contained the report after it is filtered out (e.g. after Submit)', () => {
            // Start on report "1" in a stable fast-path list [1, 2, 3].
            mockSortedReportIDs = ['1', '2', '3'];
            mockUseSearchSections.mockReturnValue({allReports: ['1', '2', '3'], isSearchLoading: false, lastSearchQuery: undefined});

            const {result, rerender} = renderHook(() => useNavigationSource('1'));
            expect(result.current.effectiveAllReports).toEqual(['1', '2', '3']);

            // Submitting "1" triggers a search refresh: isSearchLoading toggles, then "1" drops out
            // of the live list. The same content instance re-renders (no unmount), so the cached list
            // must keep "1" present and the carousel populated.
            mockSortedReportIDs = ['2', '3'];
            mockUseSearchSections.mockReturnValue({allReports: ['2', '3'], isSearchLoading: false, lastSearchQuery: undefined});
            rerender({});

            expect(result.current.allReports).toEqual(['2', '3']);
            expect(result.current.effectiveAllReports).toEqual(['1', '2', '3']);
        });
    });

    describe('pagination past the first page (#101453)', () => {
        let store: FakeStore;
        let rafSpy: jest.SpyInstance;

        /** useOnyx fake backed by `store`, honoring selectors like the real hook does. */
        function connectFakeStore() {
            mockUseOnyx.mockImplementation((key: string, options?: {selector?: (value: unknown) => unknown}) => {
                const value = store[key];
                return [options?.selector ? options.selector(value) : value];
            });
        }

        function setStore({persistedOffset, hasMoreResults, snapshotOffset, isLoading, reportCount}: Record<string, unknown> & {reportCount: number}) {
            store = {
                [ONYXKEYS.REPORT_NAVIGATION_LAST_SEARCH_QUERY]: {
                    queryJSON: {type: CONST.SEARCH.DATA_TYPES.EXPENSE_REPORT, hash: HASH},
                    offset: persistedOffset,
                    hasMoreResults,
                    previousLengthOfResults: 50,
                    allowPostSearchRecount: false,
                },
                [SNAPSHOT_KEY]: {
                    search: {isLoading, offset: snapshotOffset},
                    data: buildSnapshotData(reportCount),
                },
            };
        }

        function renderNavigation(reportID: string) {
            return render(
                <MoneyRequestReportNavigation
                    reportID={reportID}
                    shouldDisplayNarrowVersion
                />,
            );
        }

        beforeEach(() => {
            jest.clearAllMocks();
            mockPrevNextButtonsProps = undefined;
            connectFakeStore();
            // Pagination requests are deferred with requestAnimationFrame; run them synchronously.
            rafSpy = jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
                callback(0);
                return 0;
            });
        });

        afterEach(() => {
            rafSpy.mockRestore();
        });

        it('keeps Next enabled at the page boundary and opens report 51 once page 2 is in the snapshot', () => {
            // Given the user is on report 50 of a 50-row context list, page 2 has been requested
            // (persisted offset 50) and its rows have landed in the snapshot, which now knows there is
            // nothing beyond report 100.
            mockSortedReportIDs = buildReportIDs(50);
            mockUseSearchSections.mockReturnValue({allReports: buildReportIDs(100), isSearchLoading: false, lastSearchQuery: undefined});
            setStore({persistedOffset: 50, hasMoreResults: false, snapshotOffset: 50, isLoading: false, reportCount: 100});

            renderNavigation('50');

            // Then the carousel must have adopted the grown snapshot-backed list: Next stays enabled
            // (the bug disabled it here because the frozen 50-row context list still won) and the count
            // is re-persisted from the real list length instead of staying at 50.
            expect(mockPrevNextButtonsProps?.isNextButtonDisabled).toBe(false);
            expect(mockSaveLastSearchParams).toHaveBeenCalledWith(expect.objectContaining({previousLengthOfResults: 100}));

            // When the user presses Next.
            act(() => {
                mockPrevNextButtonsProps?.onNext();
            });

            // Then report 51 opens.
            expect(Navigation.setParams).toHaveBeenCalledWith(expect.objectContaining({reportID: '51'}));
        });

        it('derives the next page from the snapshot cursor instead of the persisted offset', () => {
            // Given the persisted offset has run ahead to 150 while only the page at snapshot cursor 50
            // has actually landed, and more results exist.
            mockSortedReportIDs = buildReportIDs(50);
            setStore({persistedOffset: 150, hasMoreResults: true, snapshotOffset: 50, isLoading: false, reportCount: 50});

            renderNavigation('41');

            // When the user presses Next past the prefetch threshold (index 40 of 50).
            act(() => {
                mockPrevNextButtonsProps?.onNext();
            });

            // Then the request targets the first page the snapshot does not cover yet (100), not
            // persisted offset + page size (200): requesting pages beyond the missing one is what walked
            // the offset past the end of the result set and persisted hasMoreResults: false.
            expect(search).toHaveBeenCalledWith(expect.objectContaining({offset: 100}));
            expect(Navigation.setParams).toHaveBeenCalledWith(expect.objectContaining({reportID: '42'}));
        });

        it('does not re-fire or wrap to report 1 while the next page is still in flight', () => {
            // Given the user is on the last loaded report while the page-2 request is still in flight.
            mockSortedReportIDs = buildReportIDs(50);
            mockUseSearchSections.mockReturnValue({allReports: buildReportIDs(50), isSearchLoading: true, lastSearchQuery: undefined});
            setStore({persistedOffset: 50, hasMoreResults: true, snapshotOffset: 0, isLoading: true, reportCount: 50});

            renderNavigation('50');

            // When the user presses Next.
            act(() => {
                mockPrevNextButtonsProps?.onNext();
            });

            // Then no duplicate page request fires and the carousel holds position: the modulo wrap
            // used to teleport the user back to report 1 here.
            expect(search).not.toHaveBeenCalled();
            expect(Navigation.setParams).not.toHaveBeenCalled();
        });

        it('never mounts the heavy standalone subscriptions when the search fits one page', () => {
            // Given a search whose results fit in the context list (no page ever requested beyond it).
            mockSortedReportIDs = buildReportIDs(50);
            setStore({persistedOffset: 0, hasMoreResults: false, snapshotOffset: 0, isLoading: false, reportCount: 50});

            // When rendering the navigation mid-list.
            renderNavigation('10');

            // Then the fast path is preserved: the standalone child (heavy useSearchSections
            // subscriptions, removed from this path by #86238/#94928) is never mounted.
            expect(mockUseSearchSections).not.toHaveBeenCalled();
        });
    });
});
