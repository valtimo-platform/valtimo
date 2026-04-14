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

import {test, expect} from '@playwright/test';
import {PluginPage} from './page';
import {pluginTestConfiguration, pluginTypes} from './plugin-config';
import {BESLUITEN_API_CONFIGURATION_TEST_IDS} from '../../constants';

test.use({storageState: undefined});

test.describe('9.1–9.7 — Plugin overview', () => {
  let context;
  let page;
  let pluginPage;

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();

    pluginPage = new PluginPage(page, context.request);

    await page.goto('/');
    await pluginPage.goToPluginManagement();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.describe('9.3 — View plugin name (API type) in list', () => {
    test('displays plugin name column for existing configurations', async () => {
      // The pre-configured plugins (e.g. OpenZaak) should show their translated name
      const rows = pluginPage.carbonList.rows;
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThan(0);

      // Verify the second column (plugin name) is non-empty for the first row
      const firstRow = rows.first();
      const pluginNameCell = firstRow.locator('td').nth(1);
      const text = await pluginNameCell.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    });
  });

  test.describe('9.4 — View plugin identifier in list', () => {
    test('displays plugin definition key column for existing configurations', async () => {
      const rows = pluginPage.carbonList.rows;
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThan(0);

      // Verify the third column (identifier/definition key) is non-empty for the first row
      const firstRow = rows.first();
      const identifierCell = firstRow.locator('td').nth(2);
      const text = await identifierCell.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    });
  });

  test.describe('9.7 — View plugin descriptions with logos in catalog', () => {
    test.beforeAll(async () => {
      await pluginPage.openWizard();
    });

    test.afterAll(async () => {
      await pluginPage.closeWizard();
    });

    test('catalog tiles display logos', async () => {
      await pluginPage.assertCatalogTilesHaveLogos();
    });

    test('catalog tiles display titles', async () => {
      await pluginPage.assertCatalogTilesHaveTitles();
    });

    test('catalog tiles display descriptions', async () => {
      await pluginPage.assertCatalogTilesHaveDescriptions();
    });
  });
});

test.describe('9.9–9.27 — Plugin management', () => {
  let context;
  let page;
  let pluginPage;
  let request;

  // Arrange
  test.beforeAll(async ({browser, baseURL}) => {
    // Create shared context & page
    console.log({baseURL});
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    pluginPage = new PluginPage(page, request);

    await page.goto('/');
    await pluginPage.goToPluginManagement();
  });

  test.afterAll(async () => {
    await pluginPage.deleteAllTestPlugins();
    await context.close();
  });

  test.describe('Success test', () => {
    test('Add all plugins', async () => {
      for (const type of pluginTypes) {
        // Act
        if (type === 'Besluiten API') continue;

        await pluginPage.openWizard();
        await pluginPage.selectPluginType(type);
        await pluginPage.fillPluginForm(type);
        await pluginPage.saveConfiguration();

        // Assert
        await pluginPage.assertPluginExists(pluginTestConfiguration[type].pluginIdentifier);
      }
    });

    test('Add Besluiten API plugin', async () => {
      // Act
      await pluginPage.openWizard();
      await pluginPage.selectPluginType('Besluiten API');
      await pluginPage.fillPluginForm('Besluiten API');
      await pluginPage.saveConfiguration();

      // Assert
      await pluginPage.assertPluginExists(
        pluginTestConfiguration['Besluiten API'].pluginIdentifier
      );
    });

    test('Duplicate Besluiten API plugin', async () => {
      // Act
      await pluginPage.duplicateConfigurationName(
        'Test Besluiten API Plugin',
        BESLUITEN_API_CONFIGURATION_TEST_IDS.configurationTitle
      );

      // Assert
      await pluginPage.assertPluginExists('Test Besluiten API Plugin - Test Duplicated');
    });

    test('Edit Besluiten API plugin through row click', async () => {
      // Act
      await pluginPage.editPluginRowClick(
        'Test Besluiten API Plugin - Test Duplicated',
        BESLUITEN_API_CONFIGURATION_TEST_IDS.configurationTitle,
        'Test Edited Besluiten API Row Click'
      );
      // Assert
      await pluginPage.assertPluginExists('Test Edited Besluiten API Row Click');
    });

    test('Edit Besluiten API plugin through menu click', async () => {
      // Act
      await pluginPage.editPluginMenuClick(
        'Test Edited Besluiten API Row Click',
        BESLUITEN_API_CONFIGURATION_TEST_IDS.configurationTitle,
        'Test Edited Besluiten API Menu Click'
      );
      // Assert
      await pluginPage.assertPluginExists('Test Edited Besluiten API Menu Click');

      await pluginPage.deletePlugin('Test Edited Besluiten API Menu Click');
    });

    test('Delete Besluiten API plugin', async () => {
      // Act
      await pluginPage.deletePlugin(pluginTestConfiguration['Besluiten API'].pluginIdentifier);

      // Assert
      await pluginPage.assertPluginDeleted('Besluiten API');
    });
  });

  test.describe('Failure test', () => {
    test('Add a plugin with duplicated configurationId', async () => {
      const pluginType = 'Catalogi API';
      const duplicatedPluginType = 'Catalogi API Same ID';

      // Act
      await pluginPage.openWizard();
      await pluginPage.selectPluginType(pluginType);
      await pluginPage.fillPluginForm(duplicatedPluginType);
      await pluginPage.saveConfiguration();
      await pluginPage.openWizard();
      await pluginPage.selectPluginType(pluginType);
      await pluginPage.fillPluginForm(duplicatedPluginType);

      //Assert
      await pluginPage.expectSameIdError();
    });

    test('Add Besluiten API plugin with incorrect RSIN', async () => {
      // Act
      await pluginPage.openWizard();
      await pluginPage.selectPluginType('Besluiten API');
      await pluginPage.fillPluginForm('Besluiten API');
      await pluginPage.fillIncorrectRsinValue(BESLUITEN_API_CONFIGURATION_TEST_IDS.rsin);

      // Assert
      await pluginPage.expectInvalidRSINError();
    });

    // TODO: After testing case importer, this needs a case setup and teardown
    // test('Delete Zaken API expecting error', async () => {
    //   // Remove Zaken API plugin
    //   await pluginPage.deleteZakenApiExpectingError();
    // });
  });
});
