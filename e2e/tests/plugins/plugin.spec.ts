import {test, expect} from '@playwright/test';
import {PluginPage} from './page';
import {pluginTestConfiguration, pluginTypes} from './plugin-config';

test.use({storageState: undefined});

test.describe('Plugin management', () => {
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
        'besluitenApiConfigurationTitle'
      );

      // Assert
      await pluginPage.assertPluginExists('Test Besluiten API Plugin - Test Duplicated');
    });

    test('Edit Besluiten API plugin through row click', async () => {
      // Act
      await pluginPage.editPluginRowClick(
        'Test Besluiten API Plugin - Test Duplicated',
        'besluitenApiConfigurationTitle',
        'Test Edited Besluiten API Row Click'
      );
      // Assert
      await pluginPage.assertPluginExists('Test Edited Besluiten API Row Click');
    });

    test('Edit Besluiten API plugin through menu click', async () => {
      // Act
      await pluginPage.editPluginMenuClick(
        'Test Edited Besluiten API Row Click',
        'besluitenApiConfigurationTitle',
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
      await pluginPage.fillIncorrectRsinValue('besluitenApiRsin');

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
