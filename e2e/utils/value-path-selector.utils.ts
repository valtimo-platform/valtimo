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

import {expect, Locator} from '@playwright/test';
import {VALUE_PATH_SELECTOR_TEST_IDS} from '../constants';

/**
 * Helpers for `valtimo-value-path-selector`.
 *
 * The component renders either a combo box (dropdown mode) or a plain text input
 * (manual mode), switched by a Carbon toggle. Which mode it starts in depends on
 * the surrounding configuration, so tests must never assume a default.
 *
 * The toggle must be clicked on its host element (`data-test-id` = toggle). Its two
 * inner candidates are both dead ends: `.cds--toggle__switch` sits inside a
 * `<label for="...">` pointing at a `<button>` (browsers do not forward label clicks to
 * buttons, so the click is a silent no-op), and the `role="switch"` button itself is a
 * 1x1px visually-hidden a11y control that Playwright cannot click.
 */

/** Switches the selector to manual mode (if it is not already) and returns the text input. */
export async function ensureManualPathMode(selector: Locator): Promise<Locator> {
  const input = selector.getByTestId(VALUE_PATH_SELECTOR_TEST_IDS.input);
  const toggle = selector.getByTestId(VALUE_PATH_SELECTOR_TEST_IDS.toggle);

  await expect(async () => {
    if ((await input.count()) === 0) {
      await toggle.click();
    }
    await expect(input).toBeVisible({timeout: 2_000});
  }).toPass({timeout: 15_000});

  return input;
}

/**
 * Switches the selector to manual mode and types a path into it.
 *
 * Toggling to manual mode runs a `setTimeout(detectChanges, 1)` before the input is
 * wired to the parent form, so a value filled immediately can land before the CVA
 * subscription is active and the required `path` control never commits (leaving the
 * modal's save button disabled). Re-fill until the input actually holds the value.
 */
export async function fillValuePathManually(selector: Locator, path: string): Promise<void> {
  const input = await ensureManualPathMode(selector);

  await expect(async () => {
    await input.fill(path);
    await input.blur();
    await expect(input).toHaveValue(path);
  }).toPass({timeout: 10_000});
}
