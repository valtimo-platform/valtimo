import {test} from '@playwright/test';
import {IkoPage} from './page';
import {serverConfiguration} from './iko-config';

test.use({storageState: undefined});

test.describe('IKO Management', () => {
  let context;
  let page;
  let ikoPage: IkoPage;

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();

    ikoPage = new IkoPage(page);

    await page.goto('/');
    await ikoPage.goToIkoManagement();
  });

  test.afterAll(async () => {
    await ikoPage.cleanupAll();
    await context.close();
  });

  test.describe('Success test', () => {
    test('Configure an IKO server', async () => {
      // Act
      await ikoPage.openServerModal();
      await ikoPage.fillServerForm();
      await ikoPage.saveServerConfiguration();

      // Assert
      await ikoPage.assertServerExists(serverConfiguration.title);
    });

    test('Navigate to server and add a view', async () => {
      // Act — navigate into server
      await ikoPage.clickServerRow(serverConfiguration.title);

      // Act — add view
      await ikoPage.openViewModal();
      await ikoPage.fillViewForm();
      await ikoPage.saveViewConfiguration();

      // Assert
      await ikoPage.assertViewExists('Klant');
    });
  });
});
