/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Page} from '@playwright/test';

/**
 * Carbon modals reset their reactive form on a deferred timer
 * (`runAfterCarbonModalClosed` → `setTimeout(..., CARBON_CONSTANTS.modalAnimationMs)`,
 * 240 ms). When a test closes one modal (via save or cancel) and immediately
 * opens the next, that pending reset can fire *after* the new modal is open and
 * partially filled — wiping the form and leaving the Save/Next button
 * permanently disabled. This is a wall-clock `setTimeout` with no observable DOM
 * signal to await, so the only reliable synchronization is to wait the window
 * out before interacting with a freshly-opened modal.
 *
 * Call this right after a modal becomes visible, before filling it.
 */
export const MODAL_RESET_SETTLE_MS = 350;

export async function settleModalReset(page: Page): Promise<void> {
  await page.waitForTimeout(MODAL_RESET_SETTLE_MS);
}
