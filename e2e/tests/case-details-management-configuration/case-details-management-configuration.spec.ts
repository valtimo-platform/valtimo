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

import {expect, test} from '@playwright/test';
import {
  createConfigurationTestData,
  DRAFT_CASE_IDENTIFIER,
  FINAL_CASE_KEY,
  FINAL_CASE_VERSION,
  FINAL_CONFIGURATION_DEFAULT,
  FINAL_CONFIGURATION_KEY,
} from './case-details-management-configuration';
import {CaseDetailsManagementConfigurationPage} from './page';

test.use({storageState: undefined});

// The list renders an empty cell as a dash.
const EMPTY_VALUE = '-';

// Tests share one page and depend on each other (add → edit → set → clear → delete).
test.describe.configure({mode: 'serial'});

test.describe('Case details management — Configuration', () => {
  let context;
  let page;
  let configurationPage: CaseDetailsManagementConfigurationPage;
  let draftVersion: string;

  const testData = createConfigurationTestData();

  // Arrange
  test.beforeAll(async ({browser, baseURL}) => {
    test.setTimeout(90_000);
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    configurationPage = new CaseDetailsManagementConfigurationPage(page);

    await configurationPage.ensureFinalCaseWithDeclaration(
      FINAL_CASE_KEY,
      FINAL_CASE_VERSION,
      FINAL_CONFIGURATION_KEY,
      FINAL_CONFIGURATION_DEFAULT
    );
    await configurationPage.clearEnvironmentValueViaApi(
      FINAL_CASE_KEY,
      FINAL_CASE_VERSION,
      FINAL_CONFIGURATION_KEY
    );

    draftVersion = await configurationPage.goToDraftConfiguration(DRAFT_CASE_IDENTIFIER);
    await configurationPage.cleanupStaleDeclarationsViaApi(DRAFT_CASE_IDENTIFIER, draftVersion);
    await configurationPage.reload();
  });

  test.afterAll(async () => {
    await configurationPage.deleteDeclarationViaApi(
      DRAFT_CASE_IDENTIFIER,
      draftVersion,
      testData.key
    );
    await configurationPage.clearEnvironmentValueViaApi(
      DRAFT_CASE_IDENTIFIER,
      draftVersion,
      testData.key
    );
    await configurationPage.clearEnvironmentValueViaApi(
      FINAL_CASE_KEY,
      FINAL_CASE_VERSION,
      FINAL_CONFIGURATION_KEY
    );

    if (context) await context.close();
  });

  test.describe('Draft version', () => {
    test('Add a configuration with a default value', async () => {
      // Act
      await configurationPage.addDeclaration(testData.key, testData.defaultValue);

      // Assert
      await configurationPage.assertRow(testData.key, testData.defaultValue, EMPTY_VALUE);
    });

    test('Edit the default value', async () => {
      // Act
      await configurationPage.editDefaultValue(testData.key, testData.updatedDefaultValue);

      // Assert
      await configurationPage.assertRow(testData.key, testData.updatedDefaultValue, EMPTY_VALUE);
    });

    test('Set an environment value that survives a reload', async () => {
      // Act
      await configurationPage.setEnvironmentValue(testData.key, testData.environmentValue);
      await configurationPage.reload();

      // Assert
      await configurationPage.assertRow(
        testData.key,
        testData.updatedDefaultValue,
        testData.environmentValue
      );
    });

    test('Clear the environment value', async () => {
      // Act
      await configurationPage.clearEnvironmentValue(testData.key);

      // Assert
      await configurationPage.assertRow(testData.key, testData.updatedDefaultValue, EMPTY_VALUE);
    });

    test('Delete the configuration', async () => {
      // Act
      await configurationPage.deleteDeclaration(testData.key);

      // Assert
      await configurationPage.row(testData.key).assertNotVisible();
    });
  });

  test.describe('Final version', () => {
    test('Declarations cannot be added or edited', async () => {
      // Act
      await configurationPage.goToConfiguration(FINAL_CASE_KEY, FINAL_CASE_VERSION);

      // Assert
      await configurationPage.assertRow(FINAL_CONFIGURATION_KEY, FINAL_CONFIGURATION_DEFAULT, EMPTY_VALUE);
      await expect(configurationPage.addButton).toHaveCount(0);
      const row = configurationPage.row(FINAL_CONFIGURATION_KEY);
      await row.openActionMenu();
      expect(await row.actionLabels()).toEqual([
        'Set environment value',
        'Clear environment value',
      ]);
      await page.keyboard.press('Escape');
    });

    test('Set an environment value that survives a reload', async () => {
      // Act
      await configurationPage.setEnvironmentValue(FINAL_CONFIGURATION_KEY, testData.environmentValue);
      await configurationPage.reload();

      // Assert
      await configurationPage.assertRow(
        FINAL_CONFIGURATION_KEY,
        FINAL_CONFIGURATION_DEFAULT,
        testData.environmentValue
      );
    });

    test('Clear the environment value', async () => {
      // Act
      await configurationPage.clearEnvironmentValue(FINAL_CONFIGURATION_KEY);

      // Assert
      await configurationPage.assertRow(FINAL_CONFIGURATION_KEY, FINAL_CONFIGURATION_DEFAULT, EMPTY_VALUE);
    });
  });
});
