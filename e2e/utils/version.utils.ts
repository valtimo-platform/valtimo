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

import {expect, Page} from '@playwright/test';

const VERSION_DROPDOWN_TEST_ID = 'caseVersionSelectDropdown';

/**
 * Waits until the URL stops changing.
 *
 * Selecting a version triggers a navigation that the app follows up with a redirect to the
 * `/general` tab. That redirect can land well after the click, so a caller that only waits for
 * "the URL changed" may navigate somewhere else and then be thrown back to `/general` on the
 * previously selected version — mid-test, in another test of the same describe.
 */
async function waitForUrlToSettle(page: Page, quietMs = 750): Promise<void> {
  await expect(async () => {
    const before = page.url();
    await page.waitForTimeout(quietMs);
    expect(page.url()).toBe(before);
  }).toPass({timeout: 20_000});
}

async function getDropdownText(page: Page): Promise<string> {
  const dropdown = page.getByTestId(VERSION_DROPDOWN_TEST_ID);
  await dropdown.waitFor({state: 'visible'});
  await page.waitForFunction(
    testId => {
      const el = document.querySelector(`[data-test-id="${testId}"]`);
      return el && /\d+\.\d+\.\d+/.test(el.textContent || '');
    },
    VERSION_DROPDOWN_TEST_ID
  );
  return dropdown.innerText();
}

/**
 * Ensures a draft version is selected in the case version dropdown.
 * If the currently selected version is already a draft, does nothing.
 * Returns the version tag of the selected draft version.
 */
export async function ensureDraftVersionSelected(page: Page): Promise<string> {
  const dropdown = page.getByTestId(VERSION_DROPDOWN_TEST_ID);

  await expect(async () => {
    if (!(await getDropdownText(page)).includes('DRAFT')) {
      const currentUrl = page.url();
      await dropdown.click();
      const draftOption = page
        .getByRole('listbox')
        .locator('[data-test-id^="caseVersion"]:has-text("DRAFT")')
        .first();
      await draftOption.click();
      await page.waitForURL(url => url.toString() !== currentUrl);
    }

    // Only trust the selection once the navigation it triggers has finished: the app can still
    // redirect afterwards, which would otherwise strand the caller on the previous version.
    await waitForUrlToSettle(page);
    expect(await getDropdownText(page)).toContain('DRAFT');
  }).toPass({timeout: 60_000});

  return getVersionFromUrl(page);
}

/**
 * Ensures a final (non-draft) version is selected in the case version dropdown.
 * If the currently selected version is already final, does nothing.
 * Returns the version tag of the selected final version.
 */
export async function ensureFinalVersionSelected(page: Page): Promise<string> {
  const dropdown = page.getByTestId(VERSION_DROPDOWN_TEST_ID);

  await expect(async () => {
    if ((await getDropdownText(page)).includes('DRAFT')) {
      const currentUrl = page.url();
      await dropdown.click();
      const finalOption = page
        .getByRole('listbox')
        .locator('[data-test-id^="caseVersion"]:not(:has-text("DRAFT"))')
        .first();
      await finalOption.click();
      await page.waitForURL(url => url.toString() !== currentUrl);
    }

    await waitForUrlToSettle(page);
    expect(await getDropdownText(page)).not.toContain('DRAFT');
  }).toPass({timeout: 60_000});

  return getVersionFromUrl(page);
}

/**
 * Extracts the version tag from the current page URL.
 */
export function getVersionFromUrl(page: Page): string {
  const match = page.url().match(/\/version\/([^/]+)/);
  if (!match) {
    throw new Error(`Could not extract version from URL: ${page.url()}`);
  }
  return match[1];
}
