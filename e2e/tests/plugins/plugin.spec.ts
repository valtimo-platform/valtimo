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
import {
  pluginDetailTestData,
  pluginDetailTitles,
  pluginTestConfiguration,
  pluginTypes,
} from './plugin-config';
import {
  BESLUITEN_API_CONFIGURATION_TEST_IDS,
  OPEN_ZAAK_CONFIGURATION_TEST_IDS,
} from '../../constants';

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

    // Clean up stale test plugins from previous runs
    await pluginPage.deleteAllTestPlugins();
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

// The configuration ID, authentication dropdown and edit-form fields are all part of one
// configuration lifecycle: create without an ID → inspect → edit each field. Serial mode keeps
// them in order and shares a single browser context.
test.describe.configure({mode: 'serial'});

test.describe('9.12–9.25 — Plugin configuration details', () => {
  let context;
  let page;
  let pluginPage: PluginPage;

  /** UUID assigned by the backend to the configuration created in 9.12. */
  let generatedConfigurationId: string;

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();

    pluginPage = new PluginPage(page, context.request);

    await page.goto('/');
    await pluginPage.goToPluginManagement();

    // Remove leftovers from an interrupted previous run before creating anything.
    await pluginPage.deleteConfigurationsByTitleViaApi(pluginDetailTitles);
    await pluginPage.goToPluginManagement();

    // A second authentication configuration, so the authentication dropdown has a real choice
    // to offer (9.17) and something to switch to (9.25).
    await pluginPage.createOpenZaakAuthConfiguration(
      OPEN_ZAAK_CONFIGURATION_TEST_IDS.configurationTitle,
      OPEN_ZAAK_CONFIGURATION_TEST_IDS.clientId,
      OPEN_ZAAK_CONFIGURATION_TEST_IDS.clientSecret
    );
  });

  test.afterAll(async () => {
    // Delete the Besluiten configuration before the authentication configuration it references.
    await pluginPage.deleteConfigurationsByTitleViaApi(pluginDetailTitles);

    if (context) await context.close();
  });

  // ─── 9.12 Auto-generate configuration ID ──────────────────────────

  test.describe('9.12 — Auto-generate configuration ID', () => {
    test('Configuration ID is optional and shows a UUID placeholder', async () => {
      await pluginPage.openWizard();
      await pluginPage.selectPluginTypeByTitle('Besluiten API');

      // Assert — the field starts empty; the placeholder shows the expected UUID shape
      await expect(pluginPage.configurationIdInput).toHaveValue('');
      await expect(pluginPage.configurationIdInput).toHaveAttribute(
        'placeholder',
        '00000000-0000-0000-0000-000000000000'
      );
    });

    test('Saving without a configuration ID generates a UUID', async () => {
      // Act — fill every required field but leave the configuration ID blank
      await pluginPage.fillModalInput(
        BESLUITEN_API_CONFIGURATION_TEST_IDS.configurationTitle,
        pluginDetailTestData.besluitenTitle
      );
      await pluginPage.fillModalInput(
        BESLUITEN_API_CONFIGURATION_TEST_IDS.rsin,
        pluginDetailTestData.rsin
      );
      await pluginPage.fillModalInput(
        BESLUITEN_API_CONFIGURATION_TEST_IDS.url,
        pluginDetailTestData.url
      );
      await pluginPage.selectSelectOption(
        BESLUITEN_API_CONFIGURATION_TEST_IDS.authenticationPluginConfiguration,
        pluginDetailTestData.seededAuthOptionLabel
      );
      await expect(pluginPage.configurationIdInput).toHaveValue('');
      await pluginPage.saveConfiguration();

      // Assert — the configuration is created and the backend assigned it a UUID
      await pluginPage.assertPluginExists(pluginDetailTestData.besluitenTitle);
      generatedConfigurationId = await pluginPage.assertConfigurationIdIsGeneratedUuid(
        pluginDetailTestData.besluitenTitle
      );
    });
  });

  // ─── 9.17 View authentication options ─────────────────────────────

  test.describe('9.17 — View authentication options', () => {
    test('Dropdown lists every compatible authentication configuration', async () => {
      await pluginPage.openWizard();
      await pluginPage.selectPluginTypeByTitle('Besluiten API');

      // Act
      const options = await pluginPage.getSelectOptionLabels(
        BESLUITEN_API_CONFIGURATION_TEST_IDS.authenticationPluginConfiguration
      );

      // Assert — both the seeded and the test authentication configuration are offered,
      // each labelled "<configuration title> - <plugin title>"
      expect(options).toContain(pluginDetailTestData.seededAuthOptionLabel);
      expect(options).toContain(pluginDetailTestData.altAuthOptionLabel);
      for (const option of options) expect(option).not.toBe('');

      await pluginPage.closeWizard();
    });
  });

  // ─── 9.19 Cancel plugin configuration ─────────────────────────────

  test.describe('9.19 — Cancel plugin configuration', () => {
    test('Cancelling the wizard closes it without saving', async () => {
      const countBefore = (await pluginPage.getAllConfigurations()).length;

      // Act — get to step 2, enter data, then cancel
      await pluginPage.openWizard();
      await pluginPage.selectPluginTypeByTitle('Besluiten API');
      await pluginPage.fillModalInput(
        BESLUITEN_API_CONFIGURATION_TEST_IDS.configurationTitle,
        'E2e Cancelled Plugin'
      );
      await pluginPage.cancelWizardButton.click();

      // Assert — the wizard closed immediately (there is no "discard changes?" confirmation)
      // and nothing was persisted
      await expect(pluginPage.visibleModal).toHaveCount(0);
      await pluginPage.assertConfigurationCount(countBefore);
      await expect(page.getByText('E2e Cancelled Plugin')).toHaveCount(0);
    });
  });

  // ─── 9.21 View configuration ID ───────────────────────────────────

  test.describe('9.21 — View configuration ID', () => {
    test('Edit modal shows the assigned UUID', async () => {
      // Act
      await pluginPage.openEditModal(pluginDetailTestData.besluitenTitle);

      // Assert — the generated UUID from 9.12 is prefilled
      await pluginPage.assertConfigurationIdDisplayed(generatedConfigurationId);

      await pluginPage.closeEditModal();
    });
  });

  // ─── 9.23 Edit RSIN ───────────────────────────────────────────────

  test.describe('9.23 — Edit RSIN', () => {
    test('RSIN change is persisted', async () => {
      // Act
      await pluginPage.openEditModal(pluginDetailTestData.besluitenTitle);
      await pluginPage.fillModalInput(
        BESLUITEN_API_CONFIGURATION_TEST_IDS.rsin,
        pluginDetailTestData.updatedRsin
      );
      await pluginPage.saveEditModal();

      // Assert
      await pluginPage.assertConfigurationProperty(
        pluginDetailTestData.besluitenTitle,
        'rsin',
        pluginDetailTestData.updatedRsin
      );
    });
  });

  // ─── 9.24 Edit API URL ────────────────────────────────────────────

  test.describe('9.24 — Edit API URL', () => {
    test('API URL change is persisted', async () => {
      // Act
      await pluginPage.openEditModal(pluginDetailTestData.besluitenTitle);
      await pluginPage.fillModalInput(
        BESLUITEN_API_CONFIGURATION_TEST_IDS.url,
        pluginDetailTestData.updatedUrl
      );
      await pluginPage.saveEditModal();

      // Assert
      await pluginPage.assertConfigurationProperty(
        pluginDetailTestData.besluitenTitle,
        'url',
        pluginDetailTestData.updatedUrl
      );
    });
  });

  // ─── 9.25 Change authentication plugin ────────────────────────────

  test.describe('9.25 — Change authentication plugin', () => {
    test('Authentication configuration can be switched', async () => {
      const altAuthConfiguration = await pluginPage.getConfigurationByTitle(
        pluginDetailTestData.altAuthTitle
      );
      expect(altAuthConfiguration).toBeTruthy();

      // Act — switch from the seeded authentication configuration to the test one
      await pluginPage.openEditModal(pluginDetailTestData.besluitenTitle);
      await pluginPage.selectSelectOption(
        BESLUITEN_API_CONFIGURATION_TEST_IDS.authenticationPluginConfiguration,
        pluginDetailTestData.altAuthOptionLabel
      );
      await pluginPage.saveEditModal();

      // Assert — the stored property now points at the other configuration's UUID
      await pluginPage.assertConfigurationProperty(
        pluginDetailTestData.besluitenTitle,
        'authenticationPluginConfiguration',
        altAuthConfiguration!.id
      );
    });
  });

  // ─── Failure scenarios ────────────────────────────────────────────

  test.describe('Failure scenarios', () => {
    /**
     * The backend rejects an invalid RSIN on update with a 500 and the modal stays open.
     *
     * Two defects are deliberately not asserted here, so that fixing either does not fail this
     * test:
     *   - no error toast is shown (the create path does show one — see `expectInvalidRSINError`);
     *   - the invalid value is persisted anyway, i.e. the failed update is not rolled back.
     * The test therefore restores a valid RSIN afterwards instead of asserting the old value
     * survived.
     */
    test('Cannot save an edit with an invalid RSIN', async () => {
      await pluginPage.openEditModal(pluginDetailTestData.besluitenTitle);

      // Act — an RSIN that fails the backend's 11-proof validation
      await pluginPage.fillModalInput(BESLUITEN_API_CONFIGURATION_TEST_IDS.rsin, '1');

      // Assert — the update is rejected and the modal does not close
      await pluginPage.expectEditSaveError();

      // Restore a valid RSIN so the remaining tests start from a consistent configuration
      await pluginPage.fillModalInput(
        BESLUITEN_API_CONFIGURATION_TEST_IDS.rsin,
        pluginDetailTestData.updatedRsin
      );
      await pluginPage.saveEditModal();
      await pluginPage.assertConfigurationProperty(
        pluginDetailTestData.besluitenTitle,
        'rsin',
        pluginDetailTestData.updatedRsin
      );
    });

    test('Cannot save an edit without a configuration name', async () => {
      await pluginPage.openEditModal(pluginDetailTestData.besluitenTitle);

      // Act
      await pluginPage.fillModalInput(BESLUITEN_API_CONFIGURATION_TEST_IDS.configurationTitle, '');

      // Assert — the save button stays disabled while a required field is empty
      await expect(pluginPage.editModalSaveButton).toBeDisabled();

      await pluginPage.closeEditModal();
    });
  });
});
