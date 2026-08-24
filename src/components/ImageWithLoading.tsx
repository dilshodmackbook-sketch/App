import useNetwork from '@hooks/useNetwork';
import useThemeStyles from '@hooks/useThemeStyles';

import CONST from '@src/CONST';

import type {LayoutChangeEvent, StyleProp, ViewStyle} from 'react-native';

import delay from 'lodash/delay';
import React, {useEffect, useRef, useState} from 'react';
import {View} from 'react-native';

import type {ImageObjectPosition, ImageOnLoadEvent, ImageProps} from './Image/types';

import AttachmentOfflineIndicator from './AttachmentOfflineIndicator';
import Image from './Image';
import LoadingIndicator from './LoadingIndicator';

type ImageWithSizeLoadingProps = {
    /** Any additional styles to apply */
    containerStyles?: StyleProp<ViewStyle>;

    /** Whether the image requires an authToken */
    isAuthTokenRequired: boolean;

    /** The object position of image */
    objectPosition?: ImageObjectPosition;

    /** Whether to show offline indicator */
    shouldShowOfflineIndicator?: boolean;

    /** Invoked on mount and layout changes */
    onLayout?: (event: LayoutChangeEvent) => void;

    /** Low-resolution URI shown as a placeholder while the full image loads */
    previewUri?: string;
} & ImageProps;

function ImageWithLoading({
    onError,
    containerStyles,
    shouldShowOfflineIndicator = true,
    loadingIconSize,
    waitForSession,
    loadingIndicatorStyles,
    resizeMode,
    onLoad,
    onLayout,
    style,
    previewUri,
    ...rest
}: ImageWithSizeLoadingProps) {
    const styles = useThemeStyles();
    const isLoadedRef = useRef<boolean | null>(null);
    // The preview has actually painted (not merely errored). A ref so the timeout hand-off can read it without a stale
    // closure, and so painting it never forces an extra render.
    const isPreviewPaintedRef = useRef(false);
    const [isImageCached, setIsImageCached] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    // The full-resolution image has actually painted. Drives the reveal of the sharp image over the preview base layer.
    const [isOriginalLoaded, setIsOriginalLoaded] = useState(false);
    // Neither derivative is guaranteed to ever emit `onLoad`/`onError` (a still-generating derivative stays silent), so
    // the transition is bounded: once it expires the loading visuals give up instead of latching on forever.
    const [hasTransitionExpired, setHasTransitionExpired] = useState(false);
    const {isOffline} = useNetwork();

    // The low-res -> full-res transition (dimmed preview + spinner) is only ever active while the full-resolution image
    // is genuinely in flight, and it can never outlive that image because the timeout below always ends it.
    const isTransitioning = isLoading && !isOriginalLoaded && !isImageCached && !isOffline && !hasTransitionExpired;

    const handleError = () => {
        onError?.();
        if (isLoadedRef.current) {
            isLoadedRef.current = false;
            setIsImageCached(false);
        }
        if (isOffline) {
            return;
        }
        setIsLoading(false);
    };

    const imageLoadedSuccessfully = (e: ImageOnLoadEvent) => {
        isLoadedRef.current = true;
        setIsLoading(false);
        setIsImageCached(true);
        setIsOriginalLoaded(true);
        onLoad?.(e);
    };

    /** Delay the loader to detect whether the image is being loaded from the cache or the internet. */
    useEffect(() => {
        if (isLoadedRef.current ?? !isLoading) {
            return;
        }
        const timeout = delay(() => {
            if (!isLoading || isLoadedRef.current) {
                return;
            }
            setIsImageCached(false);
        }, 200);
        return () => clearTimeout(timeout);
    }, [isLoading]);

    // Bound the transition so a full-resolution image that never settles cannot keep the dim/spinner on forever. This is
    // scoped to receipts (they are the only caller that passes `previewUri`) so slow ordinary images are untouched.
    useEffect(() => {
        if (!previewUri || !isLoading || isOffline || isOriginalLoaded || hasTransitionExpired) {
            return;
        }
        const timeout = delay(() => {
            setHasTransitionExpired(true);
            // If neither derivative ever painted (the per-diem repro), hand over to the receipt placeholder instead of
            // leaving a blank box under no spinner. `handleError` runs here in the timer callback, not synchronously in
            // an effect body, so it does not trigger cascading renders.
            if (isLoadedRef.current || isPreviewPaintedRef.current) {
                return;
            }
            handleError();
        }, CONST.TIMING.RECEIPT_TRANSITION_TIMEOUT);
        return () => clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- handleError is intentionally excluded: it is recreated every render, and including it would restart the transition timer on every render.
    }, [previewUri, isLoading, isOffline, isOriginalLoaded, hasTransitionExpired]);

    return (
        <View
            style={[styles.w100, styles.h100, containerStyles]}
            onLayout={onLayout}
        >
            {!!previewUri &&
                !isOriginalLoaded && (
                    // The preview is the always-visible base layer: it stays on screen until the sharp image actually
                    // paints, and it is dimmed only while the transition is genuinely active.
                    // eslint-disable-next-line react-native-a11y/has-valid-accessibility-ignores-invert-colors -- Custom Image wrapper does not support this prop.
                    <Image
                        {...rest}
                        source={{uri: previewUri}}
                        style={[styles.w100, styles.h100, isTransitioning && styles.opacitySemiTransparent, style]}
                        resizeMode={resizeMode}
                        onLoad={(e) => {
                            isPreviewPaintedRef.current = true;
                            onLoad?.(e);
                        }}
                        loadingIconSize={loadingIconSize}
                        loadingIndicatorStyles={loadingIndicatorStyles}
                    />
                )}
            {/* eslint-disable-next-line react-native-a11y/has-valid-accessibility-ignores-invert-colors -- Custom Image wrapper does not support this prop. */}
            <Image
                {...rest}
                style={[styles.w100, styles.h100, style]}
                resizeMode={resizeMode}
                onLoadStart={() => {
                    if (isLoadedRef.current ?? isLoading) {
                        return;
                    }
                    setIsLoading(true);
                }}
                onError={handleError}
                onLoad={(e) => {
                    imageLoadedSuccessfully(e);
                }}
                waitForSession={() => {
                    // Called when the image should wait for a valid session to reload
                    // At the moment this function is called, the image is not in cache anymore
                    isLoadedRef.current = false;
                    isPreviewPaintedRef.current = false;
                    setIsImageCached(false);
                    setIsLoading(true);
                    setIsOriginalLoaded(false);
                    setHasTransitionExpired(false);
                    waitForSession?.();
                }}
                loadingIconSize={loadingIconSize}
                loadingIndicatorStyles={loadingIndicatorStyles}
            />
            {isTransitioning && (
                <LoadingIndicator
                    iconSize={loadingIconSize}
                    style={[styles.opacity1, styles.bgTransparent, loadingIndicatorStyles]}
                />
            )}
            {isLoading && shouldShowOfflineIndicator && !isImageCached && <AttachmentOfflineIndicator isPreview />}
        </View>
    );
}

ImageWithLoading.displayName = 'ImageWithLoading';

export default React.memo(ImageWithLoading);
export type {ImageWithSizeLoadingProps};
