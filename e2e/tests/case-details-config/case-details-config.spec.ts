import {expect, test} from '@playwright/test';
import {expectNotificationMessage} from '../../utils/ui.utils';
import {CASE_IDENTIFIER, CASE_VERSION, statusTestData, tagTestData} from './case-details-config';
import {CaseDetailsConfigPage} from './page';

test.use({storageState: undefined});

test.describe('Case details configuration', () => {
  let context;
  let page;
  let caseDetailsConfigPage;
  let request;

  // Arrange
  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    caseDetailsConfigPage = new CaseDetailsConfigPage(page, request);

    await page.goto('/');
    await caseDetailsConfigPage.goToCaseDetailsConfig(CASE_IDENTIFIER);
  });

  test.afterAll(async () => {
    // Cleanup any remaining test data via API
    const statusKey = statusTestData.updatedTitle.toLowerCase().replace(/\s+/g, '-');
    const originalStatusKey = statusTestData.title.toLowerCase().replace(/\s+/g, '-');
    const tagKey = tagTestData.updatedTitle.toLowerCase().replace(/\s+/g, '-');
    const originalTagKey = tagTestData.title.toLowerCase().replace(/\s+/g, '-');

    await caseDetailsConfigPage.deleteStatusViaApi(CASE_IDENTIFIER, statusKey);
    await caseDetailsConfigPage.deleteStatusViaApi(CASE_IDENTIFIER, originalStatusKey);
    await caseDetailsConfigPage.deleteTagViaApi(CASE_IDENTIFIER, CASE_VERSION, tagKey);
    await caseDetailsConfigPage.deleteTagViaApi(CASE_IDENTIFIER, CASE_VERSION, originalTagKey);

    await context.close();
  });

  test.describe('Statuses', () => {
    test.describe('Success', () => {
      test('Add a status', async () => {
        // Arrange
        await caseDetailsConfigPage.switchToStatusesTab();

        // Act
        await caseDetailsConfigPage.addStatus(
          statusTestData.title,
          statusTestData.colorOption
        );

        // Assert
        await caseDetailsConfigPage.assertStatusExists(statusTestData.title);
      });

      test('Edit a status', async () => {
        // Act
        await caseDetailsConfigPage.editStatus(
          statusTestData.title,
          statusTestData.updatedTitle
        );

        // Assert
        await caseDetailsConfigPage.assertStatusExists(statusTestData.updatedTitle);
      });

      test('Delete a status', async () => {
        // Act
        await caseDetailsConfigPage.deleteStatus(statusTestData.updatedTitle);

        // Assert
        await caseDetailsConfigPage.assertStatusNotExists(statusTestData.updatedTitle);
      });
    });
  });

  test.describe('Tags', () => {
    test.describe('Success', () => {
      test('Add a tag', async () => {
        // Arrange
        await caseDetailsConfigPage.switchToTagsTab();

        // Act
        await caseDetailsConfigPage.addTag(
          tagTestData.title,
          tagTestData.colorOption
        );

        // Assert
        await caseDetailsConfigPage.assertTagExists(tagTestData.title);
      });

      test('Edit a tag', async () => {
        // Act
        await caseDetailsConfigPage.editTag(
          tagTestData.title,
          tagTestData.updatedTitle
        );

        // Assert
        await caseDetailsConfigPage.assertTagExists(tagTestData.updatedTitle);
      });

      test('Delete a tag', async () => {
        // Act
        await caseDetailsConfigPage.deleteTag(tagTestData.updatedTitle);

        // Assert
        await caseDetailsConfigPage.assertTagNotExists(tagTestData.updatedTitle);
      });
    });
  });
});
