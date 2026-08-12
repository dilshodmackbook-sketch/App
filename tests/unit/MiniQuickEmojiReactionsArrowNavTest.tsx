/**
 * Regression test for #97442 — arrows not working on the mini emoji reaction toolbar.
 *
 * The mini hover toolbar's quick-reaction row had no arrow-key handling, so only Tab/Shift+Tab
 * moved focus between the reaction buttons. The fix wires roving focus via useArrowKeyFocusManager,
 * but gates the arrow-key subscription on the row actually holding keyboard focus.
 *
 * This test pins the two properties that make the fix correct:
 *   1. Mounting the toolbar (which happens on hover) must NOT subscribe arrow handlers to the global,
 *      non-bubbling shortcut stack — otherwise arrows would be swallowed app-wide while a message is
 *      merely hovered.
 *   2. Once a reaction button receives keyboard focus (Tab lands in the row), the horizontal arrow
 *      handlers are subscribed so Left/Right can move the roving focus.
 */
import {fireEvent, render, screen} from '@testing-library/react-native';

import {LocaleContextProvider} from '@components/LocaleContextProvider';
import OnyxListItemProvider from '@components/OnyxListItemProvider';
import MiniQuickEmojiReactions from '@components/Reactions/MiniQuickEmojiReactions';

import KeyboardShortcut from '@libs/KeyboardShortcut';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';

import React from 'react';
import Onyx from 'react-native-onyx';

import createRandomReportAction from '../utils/collections/reportActions';
import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

jest.mock('@libs/KeyboardShortcut', () => ({
    __esModule: true,
    default: {
        subscribe: jest.fn(),
    },
}));

const mockSubscribe = jest.mocked(KeyboardShortcut.subscribe);

const ARROW_LEFT = CONST.KEYBOARD_SHORTCUTS.ARROW_LEFT.shortcutKey;
const ARROW_RIGHT = CONST.KEYBOARD_SHORTCUTS.ARROW_RIGHT.shortcutKey;

/** Which shortcut keys were passed to KeyboardShortcut.subscribe so far. */
function subscribedShortcutKeys(): string[] {
    return mockSubscribe.mock.calls.map((call) => String(call[0]));
}

const reportAction = createRandomReportAction(1);

function renderToolbar() {
    return render(
        <OnyxListItemProvider>
            <LocaleContextProvider>
                <MiniQuickEmojiReactions
                    reportAction={reportAction}
                    reportActionID={reportAction.reportActionID}
                    onEmojiSelected={jest.fn()}
                />
            </LocaleContextProvider>
        </OnyxListItemProvider>,
    );
}

describe('MiniQuickEmojiReactions arrow-key navigation', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    beforeEach(() => {
        mockSubscribe.mockReset();
        // useKeyboardShortcut calls the returned unsubscribe function on cleanup.
        mockSubscribe.mockReturnValue(jest.fn());
    });

    it('does NOT subscribe arrow handlers while the row only mounted on hover (no focus)', async () => {
        renderToolbar();
        await waitForBatchedUpdatesWithAct();

        // The toolbar mounts on hover before any Tab focus lands in it. If it subscribed arrow handlers now,
        // they would sit on top of the non-bubbling shortcut stack and swallow arrow keys app-wide.
        const keys = subscribedShortcutKeys();
        expect(keys).not.toContain(ARROW_LEFT);
        expect(keys).not.toContain(ARROW_RIGHT);
    });

    it('subscribes horizontal arrow handlers once a reaction button receives focus', async () => {
        renderToolbar();
        await waitForBatchedUpdatesWithAct();

        // Tab landing on the first quick-reaction button fires its onFocus, which activates the row's arrow manager.
        const [firstButton] = screen.getAllByRole(CONST.ROLE.BUTTON);
        expect(firstButton).toBeDefined();
        fireEvent(firstButton, 'focus');
        await waitForBatchedUpdatesWithAct();

        const keys = subscribedShortcutKeys();
        expect(keys).toContain(ARROW_LEFT);
        expect(keys).toContain(ARROW_RIGHT);
    });
});
