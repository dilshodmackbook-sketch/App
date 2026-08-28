import {act, renderHook} from '@testing-library/react-native';

import type Navigation from '@libs/Navigation/Navigation';

import useReportUnreadMessageScrollTracking from '@pages/inbox/report/useReportUnreadMessageScrollTracking';

import CONST from '@src/CONST';

import type {NativeScrollEvent, NativeSyntheticEvent} from 'react-native';

import createMock from '../utils/createMock';

jest.mock('@react-navigation/native', () => {
    const actualNav = jest.requireActual<typeof Navigation>('@react-navigation/native');
    return {
        ...actualNav,
        useIsFocused: jest.fn().mockImplementation(() => true),
    };
});

const reportID = '12345';
const onUnreadActionVisibleMockFn = jest.fn();
const emptyScrollEventMock = createMock<NativeSyntheticEvent<NativeScrollEvent>>({
    nativeEvent: {layoutMeasurement: {height: 0, width: 0}, contentSize: {width: 100, height: 100}, contentOffset: {x: 0, y: 0}},
});

describe('useReportUnreadMessageScrollTracking', () => {
    describe('on init and without any scrolling', () => {
        const onTrackScrollingMockFn = jest.fn();

        it('returns initial floatingMessage visibility and sets no state', () => {
            // Given
            const offsetRef = {current: 0};
            const {result} = renderHook(() =>
                useReportUnreadMessageScrollTracking({
                    reportID,
                    currentVerticalScrollingOffsetRef: offsetRef,
                    onUnreadActionVisible: onUnreadActionVisibleMockFn,
                    onTrackScrolling: onTrackScrollingMockFn,
                    hasNewerActions: false,
                    unreadMarkerReportActionIndex: -1,
                    isInverted: true,
                }),
            );

            // Then
            expect(result.current.isFloatingMessageCounterVisible).toBe(false);
            expect(onTrackScrollingMockFn).not.toHaveBeenCalled();
        });

        it('returns floatingMessage visibility that was set to a new value', () => {
            // Given
            const offsetRef = {current: 0};
            const {result, rerender} = renderHook(() =>
                useReportUnreadMessageScrollTracking({
                    reportID,
                    currentVerticalScrollingOffsetRef: offsetRef,
                    onUnreadActionVisible: onUnreadActionVisibleMockFn,
                    unreadMarkerReportActionIndex: -1,
                    isInverted: true,
                    hasNewerActions: false,
                    onTrackScrolling: onTrackScrollingMockFn,
                }),
            );

            // When
            act(() => {
                result.current.setIsFloatingMessageCounterVisible(true);
            });
            rerender({});

            // Then
            expect(result.current.isFloatingMessageCounterVisible).toBe(true);
            expect(onTrackScrollingMockFn).not.toHaveBeenCalled();
        });
    });

    describe('when scrolling', () => {
        const onTrackScrollingMockFn = jest.fn();

        it('returns floatingMessage visibility as true when scrolling outside of threshold (non-inverted list)', () => {
            // Given a non-inverted list (e.g. MoneyRequestReportActionsList), which still uses the pixel threshold
            const offsetRef = {current: 0};
            const {result, rerender} = renderHook(() =>
                useReportUnreadMessageScrollTracking({
                    reportID,
                    currentVerticalScrollingOffsetRef: offsetRef,
                    onUnreadActionVisible: onUnreadActionVisibleMockFn,
                    isInverted: false,
                    unreadMarkerReportActionIndex: -1,
                    onTrackScrolling: onTrackScrollingMockFn,
                    hasNewerActions: false,
                }),
            );

            // When
            act(() => {
                offsetRef.current = CONST.REPORT.ACTIONS.LATEST_MESSAGES_PILL_SCROLL_OFFSET_THRESHOLD + 100;
                result.current.trackVerticalScrolling(emptyScrollEventMock);
            });
            rerender({});

            // Then
            expect(result.current.isFloatingMessageCounterVisible).toBe(true);
            expect(onTrackScrollingMockFn).toHaveBeenCalledWith(emptyScrollEventMock);
        });

        it('returns floatingMessage visibility as true when the unread message is not visible in the view port', () => {
            // Given
            const offsetRef = {current: 0};
            const {result} = renderHook(() =>
                useReportUnreadMessageScrollTracking({
                    reportID,
                    currentVerticalScrollingOffsetRef: offsetRef,
                    onUnreadActionVisible: onUnreadActionVisibleMockFn,
                    isInverted: true,
                    unreadMarkerReportActionIndex: 1,
                    onTrackScrolling: onTrackScrollingMockFn,
                    hasNewerActions: false,
                }),
            );

            // When
            act(() => {
                result.current.onViewableItemsChanged({viewableItems: [{index: 1, key: 'reportActions_1', isViewable: true, item: {}}], changed: []});
            });

            expect(result.current.isFloatingMessageCounterVisible).toBe(false);

            // When
            act(() => {
                result.current.onViewableItemsChanged({viewableItems: [{index: 2, key: 'reportActions_2', isViewable: true, item: {}}], changed: []});
            });

            // Then
            expect(result.current.isFloatingMessageCounterVisible).toBe(true);
            expect(onTrackScrollingMockFn).toHaveBeenCalledWith(emptyScrollEventMock);
        });

        it('returns floatingMessage visibility as false when scrolling inside the threshold (non-inverted list)', () => {
            // Given a non-inverted list, which still uses the pixel threshold
            const offsetRef = {current: 0};
            const {result} = renderHook(() =>
                useReportUnreadMessageScrollTracking({
                    reportID,
                    currentVerticalScrollingOffsetRef: offsetRef,
                    onUnreadActionVisible: onUnreadActionVisibleMockFn,
                    unreadMarkerReportActionIndex: -1,
                    isInverted: false,
                    hasNewerActions: false,
                    onTrackScrolling: onTrackScrollingMockFn,
                }),
            );

            // When
            act(() => {
                offsetRef.current = CONST.REPORT.ACTIONS.LATEST_MESSAGES_PILL_SCROLL_OFFSET_THRESHOLD - 100;
                result.current.trackVerticalScrolling(emptyScrollEventMock);
            });

            // Then
            expect(result.current.isFloatingMessageCounterVisible).toBe(false);
            expect(onTrackScrollingMockFn).toHaveBeenCalledWith(emptyScrollEventMock);
        });

        it('returns floatingMessage visibility as false when unread message is visible', () => {
            // Given
            const offsetRef = {current: 0};
            const {result} = renderHook(() =>
                useReportUnreadMessageScrollTracking({
                    reportID,
                    currentVerticalScrollingOffsetRef: offsetRef,
                    onUnreadActionVisible: onUnreadActionVisibleMockFn,
                    unreadMarkerReportActionIndex: 1,
                    isInverted: true,
                    onTrackScrolling: onTrackScrollingMockFn,
                    hasNewerActions: false,
                }),
            );

            // When
            act(() => {
                result.current.onViewableItemsChanged({viewableItems: [{index: 2, key: 'reportActions_2', isViewable: true, item: {}}], changed: []});
            });
            expect(result.current.isFloatingMessageCounterVisible).toBe(true);

            act(() => {
                result.current.onViewableItemsChanged({viewableItems: [{index: 1, key: 'reportActions_1', isViewable: true, item: {}}], changed: []});
            });

            // Then
            expect(result.current.isFloatingMessageCounterVisible).toBe(false);
            expect(onTrackScrollingMockFn).toHaveBeenCalledWith(emptyScrollEventMock);
        });

        it('calls onUnreadActionVisible when scrolling to an extent the unread message is visible', () => {
            // Given
            const offsetRef = {current: 0};
            const onUnreadActionVisibleLocalMockFn = jest.fn();
            const {result} = renderHook(() =>
                useReportUnreadMessageScrollTracking({
                    reportID,
                    currentVerticalScrollingOffsetRef: offsetRef,
                    onUnreadActionVisible: onUnreadActionVisibleLocalMockFn,
                    unreadMarkerReportActionIndex: 1,
                    isInverted: true,
                    onTrackScrolling: onTrackScrollingMockFn,
                    hasNewerActions: false,
                }),
            );

            // When
            act(() => {
                // if unread action is not visible, the floating button will be visible
                result.current.onViewableItemsChanged({viewableItems: [{index: 2, key: 'reportActions_2', isViewable: true, item: {}}], changed: []});
            });

            expect(result.current.isFloatingMessageCounterVisible).toBe(true);
            expect(onUnreadActionVisibleLocalMockFn).toHaveBeenCalledTimes(0);

            act(() => {
                // scrolling so that the unread action is visible, should notify the consumer
                result.current.onViewableItemsChanged({viewableItems: [{index: 1, key: 'reportActions_1', isViewable: true, item: {}}], changed: []});
            });

            // Then
            expect(onUnreadActionVisibleLocalMockFn).toHaveBeenCalledTimes(1);
            expect(result.current.isFloatingMessageCounterVisible).toBe(false);
        });
    });

    describe('inverted read chat (no unread marker) drives the pill from the newest action visibility', () => {
        const onTrackScrollingMockFn = jest.fn();

        it('shows the pill when the newest action (index 0) is scrolled out of view', () => {
            // Given a read chat with a short scroll range (offset never reaches the 2000px threshold)
            const offsetRef = {current: 600};
            const {result} = renderHook(() =>
                useReportUnreadMessageScrollTracking({
                    reportID,
                    currentVerticalScrollingOffsetRef: offsetRef,
                    onUnreadActionVisible: onUnreadActionVisibleMockFn,
                    unreadMarkerReportActionIndex: -1,
                    isInverted: true,
                    hasNewerActions: false,
                    onTrackScrolling: onTrackScrollingMockFn,
                }),
            );

            // When the user scrolls up so the newest action (index 0) is no longer viewable
            act(() => {
                result.current.onViewableItemsChanged({
                    viewableItems: [
                        {index: 3, key: 'reportActions_3', isViewable: true, item: {}},
                        {index: 4, key: 'reportActions_4', isViewable: true, item: {}},
                    ],
                    changed: [],
                });
            });

            // Then the "Latest messages" pill is shown, even though the offset (600) never crosses 2000
            expect(result.current.isFloatingMessageCounterVisible).toBe(true);
        });

        it('hides the pill when the newest action (index 0) is visible', () => {
            // Given the pill is currently shown
            const offsetRef = {current: 600};
            const {result} = renderHook(() =>
                useReportUnreadMessageScrollTracking({
                    reportID,
                    currentVerticalScrollingOffsetRef: offsetRef,
                    onUnreadActionVisible: onUnreadActionVisibleMockFn,
                    unreadMarkerReportActionIndex: -1,
                    isInverted: true,
                    hasNewerActions: false,
                    onTrackScrolling: onTrackScrollingMockFn,
                }),
            );
            act(() => {
                result.current.onViewableItemsChanged({viewableItems: [{index: 3, key: 'reportActions_3', isViewable: true, item: {}}], changed: []});
            });
            expect(result.current.isFloatingMessageCounterVisible).toBe(true);

            // When the user scrolls back so the newest action (index 0) is visible again
            act(() => {
                result.current.onViewableItemsChanged({
                    viewableItems: [
                        {index: 0, key: 'reportActions_0', isViewable: true, item: {}},
                        {index: 1, key: 'reportActions_1', isViewable: true, item: {}},
                    ],
                    changed: [],
                });
            });

            // Then the pill is hidden
            expect(result.current.isFloatingMessageCounterVisible).toBe(false);
        });

        it('keeps the pill shown while index 0 is visible but newer actions are still unloaded', () => {
            // Given a read chat that still has newer actions to load (index 0 is not the true newest)
            const offsetRef = {current: 0};
            const {result} = renderHook(() =>
                useReportUnreadMessageScrollTracking({
                    reportID,
                    currentVerticalScrollingOffsetRef: offsetRef,
                    onUnreadActionVisible: onUnreadActionVisibleMockFn,
                    unreadMarkerReportActionIndex: -1,
                    isInverted: true,
                    hasNewerActions: true,
                    onTrackScrolling: onTrackScrollingMockFn,
                }),
            );

            // When index 0 of the loaded window is visible but there are newer actions above it
            act(() => {
                result.current.onViewableItemsChanged({viewableItems: [{index: 0, key: 'reportActions_0', isViewable: true, item: {}}], changed: []});
            });

            // Then the pill stays shown, because the user is not at the true newest action
            expect(result.current.isFloatingMessageCounterVisible).toBe(true);
        });

        it('never shows the pill for an aligned-to-top report', () => {
            // Given an aligned-to-top report (transaction thread / expense report)
            const offsetRef = {current: 600};
            const {result} = renderHook(() =>
                useReportUnreadMessageScrollTracking({
                    reportID,
                    currentVerticalScrollingOffsetRef: offsetRef,
                    onUnreadActionVisible: onUnreadActionVisibleMockFn,
                    unreadMarkerReportActionIndex: -1,
                    isInverted: true,
                    hasNewerActions: false,
                    onTrackScrolling: onTrackScrollingMockFn,
                    shouldBeAlignedToTop: true,
                }),
            );

            // When the newest action is out of view
            act(() => {
                result.current.onViewableItemsChanged({viewableItems: [{index: 3, key: 'reportActions_3', isViewable: true, item: {}}], changed: []});
            });

            // Then the pill stays hidden
            expect(result.current.isFloatingMessageCounterVisible).toBe(false);
        });
    });

    describe('action badge above viewport tracking', () => {
        const onTrackScrollingMockFn = jest.fn();

        it('returns isActionBadgeAboveViewport as false initially', () => {
            const offsetRef = {current: 0};
            const {result} = renderHook(() =>
                useReportUnreadMessageScrollTracking({
                    reportID,
                    currentVerticalScrollingOffsetRef: offsetRef,
                    onUnreadActionVisible: onUnreadActionVisibleMockFn,
                    onTrackScrolling: onTrackScrollingMockFn,
                    hasNewerActions: false,
                    unreadMarkerReportActionIndex: -1,
                    isInverted: true,
                    actionBadgeTargetIndex: -1,
                }),
            );

            expect(result.current.isActionBadgeAboveViewport).toBe(false);
        });

        it('returns isActionBadgeAboveViewport as true when action badge target is above the viewport in inverted list', () => {
            const offsetRef = {current: 0};
            const {result} = renderHook(() =>
                useReportUnreadMessageScrollTracking({
                    reportID,
                    currentVerticalScrollingOffsetRef: offsetRef,
                    onUnreadActionVisible: onUnreadActionVisibleMockFn,
                    onTrackScrolling: onTrackScrollingMockFn,
                    hasNewerActions: false,
                    unreadMarkerReportActionIndex: -1,
                    isInverted: true,
                    actionBadgeTargetIndex: 5,
                }),
            );

            // When viewable items are at indexes 0-3, the target at index 5 is above the viewport (higher index = above in inverted list)
            act(() => {
                result.current.onViewableItemsChanged({
                    viewableItems: [
                        {index: 0, key: 'reportActions_0', isViewable: true, item: {}},
                        {index: 1, key: 'reportActions_1', isViewable: true, item: {}},
                        {index: 2, key: 'reportActions_2', isViewable: true, item: {}},
                        {index: 3, key: 'reportActions_3', isViewable: true, item: {}},
                    ],
                    changed: [],
                });
            });

            expect(result.current.isActionBadgeAboveViewport).toBe(true);
        });

        it('returns isActionBadgeAboveViewport as false when action badge target is visible in viewport', () => {
            const offsetRef = {current: 0};
            const {result} = renderHook(() =>
                useReportUnreadMessageScrollTracking({
                    reportID,
                    currentVerticalScrollingOffsetRef: offsetRef,
                    onUnreadActionVisible: onUnreadActionVisibleMockFn,
                    onTrackScrolling: onTrackScrollingMockFn,
                    hasNewerActions: false,
                    unreadMarkerReportActionIndex: -1,
                    isInverted: true,
                    actionBadgeTargetIndex: 2,
                }),
            );

            // When viewable items include index 2, the target is visible
            act(() => {
                result.current.onViewableItemsChanged({
                    viewableItems: [
                        {index: 1, key: 'reportActions_1', isViewable: true, item: {}},
                        {index: 2, key: 'reportActions_2', isViewable: true, item: {}},
                        {index: 3, key: 'reportActions_3', isViewable: true, item: {}},
                    ],
                    changed: [],
                });
            });

            expect(result.current.isActionBadgeAboveViewport).toBe(false);
        });

        it('returns isActionBadgeAboveViewport as false when there is no action badge target', () => {
            const offsetRef = {current: 0};
            const {result} = renderHook(() =>
                useReportUnreadMessageScrollTracking({
                    reportID,
                    currentVerticalScrollingOffsetRef: offsetRef,
                    onUnreadActionVisible: onUnreadActionVisibleMockFn,
                    onTrackScrolling: onTrackScrollingMockFn,
                    hasNewerActions: false,
                    unreadMarkerReportActionIndex: -1,
                    isInverted: true,
                    actionBadgeTargetIndex: -1,
                }),
            );

            act(() => {
                result.current.onViewableItemsChanged({
                    viewableItems: [{index: 0, key: 'reportActions_0', isViewable: true, item: {}}],
                    changed: [],
                });
            });

            expect(result.current.isActionBadgeAboveViewport).toBe(false);
        });

        it('preserves isActionBadgeAboveViewport when viewable items are briefly empty (FlashList scroll animation)', () => {
            const offsetRef = {current: 0};
            const {result} = renderHook(() =>
                useReportUnreadMessageScrollTracking({
                    reportID,
                    currentVerticalScrollingOffsetRef: offsetRef,
                    onUnreadActionVisible: onUnreadActionVisibleMockFn,
                    onTrackScrolling: onTrackScrollingMockFn,
                    hasNewerActions: false,
                    unreadMarkerReportActionIndex: -1,
                    isInverted: true,
                    actionBadgeTargetIndex: 5,
                }),
            );

            // First, make the badge visible above viewport
            act(() => {
                result.current.onViewableItemsChanged({
                    viewableItems: [{index: 0, key: 'reportActions_0', isViewable: true, item: {}}],
                    changed: [],
                });
            });
            expect(result.current.isActionBadgeAboveViewport).toBe(true);

            // When viewable items are briefly empty (FlashList internal behavior during scroll), state should be preserved
            act(() => {
                result.current.onViewableItemsChanged({viewableItems: [], changed: []});
            });
            expect(result.current.isActionBadgeAboveViewport).toBe(true);
        });

        it('recalculates action badge visibility when actionBadgeTargetIndex changes', () => {
            const offsetRef = {current: 0};
            let actionBadgeTargetIndex = -1;
            const {result, rerender} = renderHook(() =>
                useReportUnreadMessageScrollTracking({
                    reportID,
                    currentVerticalScrollingOffsetRef: offsetRef,
                    onUnreadActionVisible: onUnreadActionVisibleMockFn,
                    onTrackScrolling: onTrackScrollingMockFn,
                    hasNewerActions: false,
                    unreadMarkerReportActionIndex: -1,
                    isInverted: true,
                    actionBadgeTargetIndex,
                }),
            );

            // Set up viewable items first
            act(() => {
                result.current.onViewableItemsChanged({
                    viewableItems: [
                        {index: 0, key: 'reportActions_0', isViewable: true, item: {}},
                        {index: 1, key: 'reportActions_1', isViewable: true, item: {}},
                    ],
                    changed: [],
                });
            });
            expect(result.current.isActionBadgeAboveViewport).toBe(false);

            // Now set the target to an index above the viewport
            actionBadgeTargetIndex = 5;
            rerender({});

            expect(result.current.isActionBadgeAboveViewport).toBe(true);
        });
    });
});
