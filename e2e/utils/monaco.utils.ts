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
