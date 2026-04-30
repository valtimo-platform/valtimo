import { Page, expect } from '@playwright/test';

export async function expectNotificationMessage(
  page: Page,
  expectedText: string,
  options?: { exact?: boolean }
) {
  const errorLocator = options?.exact
    ? page.getByText(expectedText, { exact: true }).first()
    : page.getByText(expectedText).first();

  await expect(errorLocator).toBeVisible({timeout: 15_000});
  await expect(errorLocator).toContainText(expectedText);
}

export async function expectButtonDisabledByName(
  page: Page,
  buttonName: string
) {
  const button = page.getByRole('button', { name: buttonName });
  await expect(button).toBeVisible();

  const disabledAttr = await button.getAttribute('disabled');
  if (disabledAttr === null) {
    throw new Error(`[expectButtonDisabledByName] Button "${buttonName}" is not disabled (missing 'disabled' attribute)`);
  }
}

export async function switchVersion(page: Page, version: number) {
  const versionButton = page.getByRole('button', { name: /version:/i });
  await expect(versionButton).toBeVisible();
  await versionButton.click();
  await page.getByText(`Version: ${version}`).click();
}

export async function assertVersionIsVisible(page: Page, version: number) {
  const versionLabel = page.getByText(`Version: ${version}`, { exact: true });
  await expect(versionLabel).toBeVisible();
}
