import {act, renderHook} from '@testing-library/react-native';

import useScreenBoundDynamicRoute from '@hooks/useScreenBoundDynamicRoute';

import createDynamicRoute from '@libs/Navigation/helpers/dynamicRoutesUtils/createDynamicRoute';
import getStateFromPath from '@libs/Navigation/helpers/getStateFromPath';
import Navigation from '@libs/Navigation/Navigation';

import createPlatformStackNavigator from '@navigation/PlatformStackNavigation/createPlatformStackNavigator';

import ROUTES, {DYNAMIC_ROUTES} from '@src/ROUTES';

import type {ReactNode} from 'react';

import {createNavigationContainerRef, NavigationContainer} from '@react-navigation/native';
import React from 'react';

/**
 * Regression coverage for https://github.com/Expensify/App/issues/98993
 *
 * A confirmation-list field (Merchant here) builds its route with `createDynamicRoute(suffix)` and no explicit
 * basePath, so the base is resolved from `Navigation.getActiveRoute()` at tap time. When the user swipes back and
 * taps a field mid-transition, the still-active route is a sibling money-request step (e.g. expense-date) that
 * already carries `?action=...`. The merchant suffix carries `action` too, the merge treats the collision as a fatal
 * invariant and throws, and because the throw fires inside `onPress` it crashes the app in a release build.
 *
 * Binding the base to the field's own screen with `useScreenBoundDynamicRoute` keeps the base on the entry screen
 * the field belongs to, so there is no collision and the target stays correct.
 */

type TestParamList = {
    Bound: undefined;
    Stacked: undefined;
};

// REPORT is a declared entry screen for both expense-merchant and expense-date, and carries no query of its own.
const ENTRY_SCREEN_PATH = ROUTES.REPORT_WITH_ID.getRoute('1234');
const MERCHANT_SUFFIX = DYNAMIC_ROUTES.MONEY_REQUEST_STEP_MERCHANT.getRoute('create', 'submit', 'TXN1', '1234');
// The sibling step that stays active while the discard modal settles; it carries its own ?action=... query.
const STALE_SIBLING_STEP = createDynamicRoute(DYNAMIC_ROUTES.MONEY_REQUEST_STEP_DATE.getRoute('create', 'submit', 'TXN1', '1234'), ENTRY_SCREEN_PATH);

const Stack = createPlatformStackNavigator<TestParamList>();
const navigationRef = createNavigationContainerRef<TestParamList>();

function StackedScreen() {
    return null;
}

function ScreenWrapper({children}: {children: ReactNode}) {
    return (
        <NavigationContainer ref={navigationRef}>
            <Stack.Navigator>
                <Stack.Screen name="Bound">{() => children}</Stack.Screen>
                <Stack.Screen
                    name="Stacked"
                    component={StackedScreen}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
}

describe('MoneyRequest confirmation-list route crash (#98993)', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('reproduces the crash: an unbound createDynamicRoute throws when the active route is a stale sibling step', () => {
        jest.spyOn(Navigation, 'getActiveRoute').mockReturnValue(STALE_SIBLING_STEP);

        expect(() => createDynamicRoute(MERCHANT_SUFFIX)).toThrow(/exists in both base path and dynamic suffix/);
    });

    it('screen-bound builder does not throw and resolves to the merchant step even while a sibling step is active', () => {
        const getActiveRoute = jest.spyOn(Navigation, 'getActiveRoute').mockReturnValue(ENTRY_SCREEN_PATH);

        const {result} = renderHook(() => useScreenBoundDynamicRoute(), {wrapper: ScreenWrapper});

        // The sibling step becomes the active route as it animates over the confirmation screen.
        getActiveRoute.mockReturnValue(STALE_SIBLING_STEP);
        act(() => navigationRef.navigate('Stacked'));

        const boundRoute = result.current(MERCHANT_SUFFIX);

        expect(() => result.current(MERCHANT_SUFFIX)).not.toThrow();
        expect(boundRoute).toBe(`${ENTRY_SCREEN_PATH}/${MERCHANT_SUFFIX}`);
        expect(JSON.stringify(getStateFromPath(boundRoute))).not.toContain('not-found');
    });
});
