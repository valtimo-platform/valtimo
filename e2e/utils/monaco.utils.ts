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
 * Paste a string directly into a Monaco Editor instance.
 * Assumes the first editor on the page is the target.
 */
export async function pasteToMonacoEditor(page: Page, content: string) {
  const editor = page.locator('.monaco-editor').first();
  await editor.click();

  await page.evaluate(async text => {
    await navigator.clipboard.writeText(text);
  }, content);

  const isMac = process.platform === 'darwin';
  await page.keyboard.press(isMac ? 'Meta+KeyA' : 'Control+KeyA');
  await page.keyboard.press(isMac ? 'Meta+KeyV' : 'Control+KeyV');
}

/**
 * Clears the contents of the first Monaco Editor instance.
 */
export async function clearMonacoEditor(page: Page) {
  const editor = page.locator('.monaco-editor').first();
  await editor.click();

  const isMac = process.platform === 'darwin';
  // await page.keyboard.press(isMac ? 'Meta+KeyA' : 'Control+KeyA');
  await page.keyboard.press('Control+KeyA');
  await page.keyboard.press('Delete');
}
