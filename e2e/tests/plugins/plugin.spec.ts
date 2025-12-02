import {test, expect} from '@playwright/test';
import {PluginPage} from './page';
import {beforeEach} from 'node:test';
import {pluginTypes} from './plugin-config';

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
    await context.close();
  });

  test('Add all plugins', async () => {
    for (const type of pluginTypes) {
      // Act
      await pluginPage.openWizard();
      await pluginPage.selectPluginType(type);
      await pluginPage.fillPluginForm(type);
      await pluginPage.saveConfiguration();

      // Assert
      await pluginPage.assertPluginCreated(type);
    }
  });

  test('Delete Besluiten API plugin', async () => {
    // Act
    await pluginPage.deletePlugin('Besluiten API');

    // Assert
    await pluginPage.assertPluginDeleted('Besluiten API');
  });
});
