import { test, expect } from "@playwright/test";
import { PluginPage } from "./page"
import { pluginTypes } from "./plugin-config";

test.use({ storageState: undefined });

test("Plugin management", async ({ page }) => {

  const pluginPage = new PluginPage(page);

  // Log in
  console.log("Log in as admin...")
  const username = "admin";
  const password = "admin"
  await page.goto("http://localhost:4200/");
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForTimeout(1500);

  // Navigate
  await pluginPage.goToPluginManagement();

  // Create all plugins
  for (const type of pluginTypes) {
    await pluginPage.openWizard();
    await pluginPage.selectPluginType(type);
    await pluginPage.fillPluginForm(type);
    await pluginPage.saveConfiguration();
  }

  // Duplicate example
  await pluginPage.duplicateConfigurationName();

  // Delete example
  const rows = await page.locator("tbody tr").all();
  await pluginPage.deletePlugin(rows[0]);
});
