import { expect, test } from "@playwright/test";

test.use({ storageState: undefined });

test.only("Login", async ({ page }) => {
  expect(true).toBeTruthy();
  await page.goto("http://localhost:4200");
  await page.locator("#username").fill("admin");
  await page.locator("#password").fill("admin");
  await page.locator("#kc-login").click();
  await page.pause();
});
