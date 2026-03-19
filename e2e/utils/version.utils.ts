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

const VERSION_DROPDOWN_TEST_ID = 'caseVersionSelectDropdown';

/**
 * Ensures a draft version is selected in the case version dropdown.
 * If the currently selected version is already a draft, does nothing.
 * Returns the version tag of the selected draft version.
 */
export async function ensureDraftVersionSelected(page: Page): Promise<string> {
  const dropdown = page.getByTestId(VERSION_DROPDOWN_TEST_ID);
  const selectedText = await dropdown.innerText();

  if (!selectedText.includes('DRAFT')) {
    await dropdown.click();
    const draftOption = page
      .getByRole('listbox')
      .locator('[data-test-id^="caseVersion"]:has-text("DRAFT")')
      .first();
    await draftOption.click();
    await page.waitForURL(/\/version\/[\d.]+/);
  }

  return getVersionFromUrl(page);
}

/**
 * Ensures a final (non-draft) version is selected in the case version dropdown.
 * If the currently selected version is already final, does nothing.
 * Returns the version tag of the selected final version.
 */
export async function ensureFinalVersionSelected(page: Page): Promise<string> {
  const dropdown = page.getByTestId(VERSION_DROPDOWN_TEST_ID);
  const selectedText = await dropdown.innerText();

  if (selectedText.includes('DRAFT')) {
    await dropdown.click();
    const finalOption = page
      .getByRole('listbox')
      .locator('[data-test-id^="caseVersion"]:not(:has-text("DRAFT"))')
      .first();
    await finalOption.click();
    await page.waitForURL(/\/version\/[\d.]+/);
  }

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
