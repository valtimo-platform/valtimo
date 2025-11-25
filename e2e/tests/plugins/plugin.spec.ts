import { expect, test } from "@playwright/test";
import {PluginPage} from "./page";

test.use({ storageState: undefined });

test.only("Plugin management", async ({ page }) => {
  // Login
  console.log("Log in as admin...")
  const username = "admin";
  const password = "admin"
  const baseUrl = "http://localhost:4200/";
  await page.goto(baseUrl);
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForTimeout(1500);

  // Go to Plugin management
  console.log("Navigating to Plugin management...");
  await page.getByRole('button', { name: 'Admin' }).click();
  await page.getByRole('link', { name: 'Plugins' }).click();

  await page.waitForSelector("valtimo-carbon-list");

  // Get all table rows
  const rows = await page.locator('tbody cds-table-row, tbody tr').all();
  expect(rows.length).toBeGreaterThan(0);

  console.log(`Found ${rows.length} plugin configurations.`);

  const firstRow = rows[0];
  const firstRowText = await firstRow.innerText();
  console.log("First row text:", firstRowText);

  // Intercept DELETE call
  const deleteRequestPromise = page.waitForRequest(request =>
      request.method() === 'DELETE' &&
      request.url().includes('/v1/plugin/configuration')
  );

  const deleteResponsePromise = page.waitForResponse(response =>
      response.request().method() === 'DELETE' &&
      response.url().includes('/v1/plugin/configuration')
  );

  console.log("Deleting plugin...");
  await firstRow.getByRole('button', { name: 'Options' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();

  // Wait for DELETE request + response
  const deleteRequest = await deleteRequestPromise;
  const deleteResponse = await deleteResponsePromise;

  console.log("DELETE endpoint called:", deleteRequest.url());
  expect(deleteResponse.status()).toBe(200);

  // Wait for list to refresh
  await page.waitForTimeout(1500);

  // Re-fetch rows
  const rowsAfter = await page.locator('tbody cds-table-row, tbody tr').all();
  expect(rowsAfter.length).toBe(rows.length - 1);

  console.log("Plugin deleted successfully.");
});
