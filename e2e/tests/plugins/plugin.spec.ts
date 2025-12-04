import {test, expect} from '@playwright/test';
import {PluginPage} from './page';
import {pluginTestConfiguration, pluginTypes} from './plugin-config';

test.use({storageState: undefined});

test.describe('Plugin management', () => {
  let context;
  let page;
  let pluginPage;

  // Arrange
  test.beforeAll(async ({browser}) => {
    // Create shared context & page
    context = await browser.newContext();
    page = await context.newPage();

    pluginPage = new PluginPage(page);

    await page.goto('http://localhost:4200/');
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
        'Test Besluiten API',
        'besluitenApiConfigurationTitle'
      );

      // Assert
      await pluginPage.assertPluginExists('Test Besluiten API - Test Duplicated');
    });

    test('Edit Besluiten API plugin through row click', async () => {
      // Act
      await pluginPage.editPluginRowClick(
        'Test Besluiten API - Test Duplicated',
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
      const type = 'Catalogi API';

      // Act
      // Create a plugin
      await pluginPage.openWizard();
      await pluginPage.selectPluginType(type);
      await pluginPage.fillPluginForm(type);
      await pluginPage.saveConfiguration();
      await pluginPage.assertPluginExists(pluginTestConfiguration[type].pluginIdentifier);

      // Force pluginConfigurationId duplication
      const originalId = pluginTestConfiguration[type].fieldMap.find(
          f => f.testId === 'pluginConfigurationId'
      ).value;

      await pluginPage.openWizard();
      await pluginPage.selectPluginType(type);

      // Fill duplicated ID
      const idInput = pluginPage.page.getByTestId('pluginConfigurationId').locator('input');
      await idInput.fill(originalId);

      // Fill other fields
      const otherFields = pluginTestConfiguration[type].fieldMap.filter(
          f => f.testId !== 'pluginConfigurationId'
      );

      for (const field of otherFields) {
        const wrapper = pluginPage.page.getByTestId(field.testId);
        if (field.type === 'input') {
          await wrapper.locator('input').fill(field.value);
        } else {
          await wrapper.locator('cds-combo-box').click();
          await wrapper.getByRole('option').getByText(field.value).click();
        }
      }

      await pluginPage.saveConfiguration();

      // ASSERT
      const errorMessage = pluginPage.page.getByText(
          /Internal Server Error\. Details:.*already used by another plugin/i
      );

      await expect(errorMessage).toBeVisible();
      await expect(pluginPage.page.locator('.notification-overlay')).toBeVisible();
    });

    test('Add a plugin with incorrect RSIN', async () => {

    });
  });
});
