import {act, render, screen} from '@testing-library/react-native';

import ComposeProviders from '@components/ComposeProviders';
import ImageWithLoading from '@components/ImageWithLoading';
import ThemeProvider from '@components/ThemeProvider';
import ThemeStylesProvider from '@components/ThemeStylesContextProvider';

import CONST from '@src/CONST';

import React from 'react';
import {View} from 'react-native';

const PREVIEW_URI = 'https://example.com/receipt.jpg.320.jpg';
const FULL_URI = 'https://example.com/receipt.jpg.1024.jpg';

const SPINNER_TEST_ID = 'LoadingIndicator';
const PREVIEW_TEST_ID = 'PreviewImage';
const FULL_TEST_ID = 'FullImage';

type CapturedHandlers = {
    onLoad?: (e: unknown) => void;
    onLoadStart?: () => void;
    onError?: () => void;
    waitForSession?: () => void;
    style?: unknown;
};

// Captures each mocked <Image>'s callbacks keyed by which derivative it renders, so tests can drive
// ImageWithLoading's loading state machine directly. Prefixed with `mock` so the hoisted jest.mock factory may use it.
const mockImageHandlers: {preview?: CapturedHandlers; full?: CapturedHandlers} = {};

// Renders a bare <View> stand-in for a mocked component. Prefixed with `mock` for the same hoisting reason.
function mockRenderView({testID}: {testID?: string}) {
    return <View testID={testID} />;
}

jest.mock('@hooks/useNetwork', () => jest.fn(() => ({isOffline: false})));

jest.mock('@components/Image', () => {
    function MockImage({source, onLoad, onLoadStart, onError, waitForSession, style}: CapturedHandlers & {source?: {uri?: string}}) {
        const isPreview = source?.uri === 'https://example.com/receipt.jpg.320.jpg';
        mockImageHandlers[isPreview ? 'preview' : 'full'] = {onLoad, onLoadStart, onError, waitForSession, style};
        return mockRenderView({testID: isPreview ? 'PreviewImage' : 'FullImage'});
    }

    return {__esModule: true, default: MockImage};
});

jest.mock('@components/LoadingIndicator', () => {
    function MockLoadingIndicator() {
        return mockRenderView({testID: 'LoadingIndicator'});
    }
    return {__esModule: true, default: MockLoadingIndicator};
});

jest.mock('@components/AttachmentOfflineIndicator', () => {
    function MockAttachmentOfflineIndicator() {
        return mockRenderView({testID: 'AttachmentOfflineIndicator'});
    }
    return {__esModule: true, default: MockAttachmentOfflineIndicator};
});

function renderImageWithLoading(props?: Partial<React.ComponentProps<typeof ImageWithLoading>>) {
    return render(
        <ComposeProviders components={[ThemeProvider, ThemeStylesProvider]}>
            <ImageWithLoading
                source={{uri: FULL_URI}}
                previewUri={PREVIEW_URI}
                isAuthTokenRequired
                {...props}
            />
        </ComposeProviders>,
    );
}

/** Fires the full-resolution image's onLoadStart, matching what expo-image emits when the source is set. */
function startFullResLoad() {
    act(() => {
        mockImageHandlers.full?.onLoadStart?.();
    });
}

/** Advances past the 200ms cache probe so `isImageCached` flips to false (the not-a-cache-hit path). */
function advancePastCacheProbe() {
    act(() => {
        jest.advanceTimersByTime(250);
    });
}

describe('ImageWithLoading', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockImageHandlers.preview = undefined;
        mockImageHandlers.full = undefined;
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    it('does not latch the spinner when neither derivative ever settles (the per-diem repro)', () => {
        const onError = jest.fn();
        renderImageWithLoading({onError});

        startFullResLoad();
        advancePastCacheProbe();

        // While the transition is active the spinner is shown over the (blank, still-loading) preview.
        expect(screen.getByTestId(SPINNER_TEST_ID)).toBeOnTheScreen();

        // Neither the preview nor the full-resolution image ever fires onLoad/onError.
        act(() => {
            jest.advanceTimersByTime(CONST.TIMING.RECEIPT_TRANSITION_TIMEOUT);
        });

        // The bounded transition expired: the spinner is gone (no infinite loader) and we handed off to the
        // receipt placeholder via onError instead of leaving a permanent spinner over an empty card.
        expect(screen.queryByTestId(SPINNER_TEST_ID)).not.toBeOnTheScreen();
        expect(onError).toHaveBeenCalledTimes(1);
    });

    it('reveals the full-resolution image over the preview when it loads (the restored transition)', () => {
        const onError = jest.fn();
        renderImageWithLoading({onError});

        startFullResLoad();
        advancePastCacheProbe();

        // Preview paints first: it is on screen and dimmed while the sharp image is still loading.
        act(() => {
            mockImageHandlers.preview?.onLoad?.({nativeEvent: {width: 32, height: 32}});
        });
        expect(screen.getByTestId(PREVIEW_TEST_ID)).toBeOnTheScreen();
        expect(screen.getByTestId(SPINNER_TEST_ID)).toBeOnTheScreen();

        // The full-resolution image loads and is revealed; the preview base layer unmounts and the spinner clears.
        act(() => {
            mockImageHandlers.full?.onLoad?.({nativeEvent: {width: 1024, height: 1024}});
        });
        expect(screen.queryByTestId(PREVIEW_TEST_ID)).not.toBeOnTheScreen();
        expect(screen.getByTestId(FULL_TEST_ID)).toBeOnTheScreen();
        expect(screen.queryByTestId(SPINNER_TEST_ID)).not.toBeOnTheScreen();
        expect(onError).not.toHaveBeenCalled();
    });

    it('keeps the readable preview and drops the spinner when only the full-resolution image never settles', () => {
        const onError = jest.fn();
        renderImageWithLoading({onError});

        startFullResLoad();
        advancePastCacheProbe();
        act(() => {
            mockImageHandlers.preview?.onLoad?.({nativeEvent: {width: 32, height: 32}});
        });

        // Full-resolution image never emits; advance past the transition bound.
        act(() => {
            jest.advanceTimersByTime(CONST.TIMING.RECEIPT_TRANSITION_TIMEOUT);
        });

        // Spinner is gone, but because the preview did paint we keep it on screen and do NOT surface the placeholder.
        expect(screen.queryByTestId(SPINNER_TEST_ID)).not.toBeOnTheScreen();
        expect(screen.getByTestId(PREVIEW_TEST_ID)).toBeOnTheScreen();
        expect(onError).not.toHaveBeenCalled();
    });

    it('never flashes the transition for a fast/cached image', () => {
        renderImageWithLoading();

        startFullResLoad();

        // The image loads inside the 200ms cache probe, so isImageCached stays true and no spinner ever renders.
        act(() => {
            mockImageHandlers.full?.onLoad?.({nativeEvent: {width: 1024, height: 1024}});
        });
        act(() => {
            jest.advanceTimersByTime(250);
        });

        expect(screen.queryByTestId(SPINNER_TEST_ID)).not.toBeOnTheScreen();
    });
});
