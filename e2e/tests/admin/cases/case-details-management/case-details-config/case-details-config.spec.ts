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
import {expectNotificationMessage} from '../../../../../utils/ui.utils';
import {
  CASE_IDENTIFIER,
  statusTestData,
  statusColorTestData,
  statusVisibilityTestData,
  statusReorderTestData,
  tagTestData,
  tagColorTestData,
} from './case-details-config';
import {CaseDetailsConfigPage} from './page';

test.use({storageState: undefined});

test.describe('Case details configuration', () => {
  let context;
  let page;
  let caseDetailsConfigPage;
  let request;
  let draftVersion: string;

  // Arrange
  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    caseDetailsConfigPage = new CaseDetailsConfigPage(page, request);

    await page.goto('/');
    await caseDetailsConfigPage.goToCaseDetailsConfig(CASE_IDENTIFIER);
    draftVersion = await caseDetailsConfigPage.ensureDraftVersionSelected();

    // Clean up data
    const statusKey = statusTestData.updatedTitle.toLowerCase().replace(/\s+/g, '-');
    const originalStatusKey = statusTestData.title.toLowerCase().replace(/\s+/g, '-');
    const colorStatusKey = statusColorTestData.title.toLowerCase().replace(/\s+/g, '-');
    const visibilityStatusKey = statusVisibilityTestData.title.toLowerCase().replace(/\s+/g, '-');
    const reorderKeyA = statusReorderTestData.titleA.toLowerCase().replace(/\s+/g, '-');
    const reorderKeyB = statusReorderTestData.titleB.toLowerCase().replace(/\s+/g, '-');
    const tagKey = tagTestData.updatedTitle.toLowerCase().replace(/\s+/g, '-');
    const originalTagKey = tagTestData.title.toLowerCase().replace(/\s+/g, '-');

    await caseDetailsConfigPage.deleteStatusViaApi(CASE_IDENTIFIER, statusKey);
    await caseDetailsConfigPage.deleteStatusViaApi(CASE_IDENTIFIER, originalStatusKey);
    await caseDetailsConfigPage.deleteStatusViaApi(CASE_IDENTIFIER, colorStatusKey);
    await caseDetailsConfigPage.deleteStatusViaApi(CASE_IDENTIFIER, visibilityStatusKey);
    await caseDetailsConfigPage.deleteStatusViaApi(CASE_IDENTIFIER, reorderKeyA);
    await caseDetailsConfigPage.deleteStatusViaApi(CASE_IDENTIFIER, reorderKeyB);
    // Clean up ALL stale test tags (catches accumulated tags from many previous runs)
    await caseDetailsConfigPage.cleanupStaleTagsViaApi(CASE_IDENTIFIER);
  });

  test.afterAll(async () => {
    // Cleanup any remaining test data via API
    const statusKey = statusTestData.updatedTitle.toLowerCase().replace(/\s+/g, '-');
    const originalStatusKey = statusTestData.title.toLowerCase().replace(/\s+/g, '-');
    const colorStatusKey = statusColorTestData.title.toLowerCase().replace(/\s+/g, '-');
    const visibilityStatusKey = statusVisibilityTestData.title.toLowerCase().replace(/\s+/g, '-');
    const reorderKeyA = statusReorderTestData.titleA.toLowerCase().replace(/\s+/g, '-');
    const reorderKeyB = statusReorderTestData.titleB.toLowerCase().replace(/\s+/g, '-');
    const tagKey = tagTestData.updatedTitle.toLowerCase().replace(/\s+/g, '-');
    const originalTagKey = tagTestData.title.toLowerCase().replace(/\s+/g, '-');
    const colorTagKey = tagColorTestData.title.toLowerCase().replace(/\s+/g, '-');

    await caseDetailsConfigPage.deleteStatusViaApi(CASE_IDENTIFIER, statusKey);
    await caseDetailsConfigPage.deleteStatusViaApi(CASE_IDENTIFIER, originalStatusKey);
    await caseDetailsConfigPage.deleteStatusViaApi(CASE_IDENTIFIER, colorStatusKey);
    await caseDetailsConfigPage.deleteStatusViaApi(CASE_IDENTIFIER, visibilityStatusKey);
    await caseDetailsConfigPage.deleteStatusViaApi(CASE_IDENTIFIER, reorderKeyA);
    await caseDetailsConfigPage.deleteStatusViaApi(CASE_IDENTIFIER, reorderKeyB);
    await caseDetailsConfigPage.deleteTagViaApi(CASE_IDENTIFIER, draftVersion, tagKey);
    await caseDetailsConfigPage.deleteTagViaApi(CASE_IDENTIFIER, draftVersion, originalTagKey);
    await caseDetailsConfigPage.deleteTagViaApi(CASE_IDENTIFIER, draftVersion, colorTagKey);

    await context.close();
  });

  test.describe('6.77–6.81 — Statuses', () => {
    test.describe('Success', () => {
      test('Add a status', async () => {
        // Arrange
        await caseDetailsConfigPage.switchToStatusesTab();

        // Act
        await caseDetailsConfigPage.addStatus(statusTestData.title);

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

    test.describe('6.79 — Set status color', () => {
      test('Add a status and set its color', async () => {
        // Arrange
        await caseDetailsConfigPage.addStatus(statusColorTestData.title);
        await caseDetailsConfigPage.assertStatusExists(statusColorTestData.title);

        // Act - edit the status and change color to Red
        await caseDetailsConfigPage.openStatusEditModal(statusColorTestData.title);
        await caseDetailsConfigPage.selectStatusColor('Red');
        await caseDetailsConfigPage.saveStatus();

        // Assert - verify color tag in the list shows 'Red'
        await caseDetailsConfigPage.assertStatusColorInList(statusColorTestData.title, 'Red');
      });

      test('Change status color to a different value', async () => {
        // Act - edit again and change to Green
        await caseDetailsConfigPage.openStatusEditModal(statusColorTestData.title);
        await caseDetailsConfigPage.selectStatusColor('Green');
        await caseDetailsConfigPage.saveStatus();

        // Assert
        await caseDetailsConfigPage.assertStatusColorInList(statusColorTestData.title, 'Green');
      });

      test('Clean up color test status', async () => {
        await caseDetailsConfigPage.deleteStatus(statusColorTestData.title);
        await caseDetailsConfigPage.assertStatusNotExists(statusColorTestData.title);
      });
    });

    test.describe('6.80 — Set status visibility', () => {
      test('Add a status with default visibility (visible)', async () => {
        // Act
        await caseDetailsConfigPage.addStatus(statusVisibilityTestData.title);

        // Assert - new statuses default to visible
        await caseDetailsConfigPage.assertStatusExists(statusVisibilityTestData.title);
        await caseDetailsConfigPage.assertStatusVisibilityInList(
          statusVisibilityTestData.title,
          true
        );
      });

      test('Toggle status visibility to invisible', async () => {
        // Act
        await caseDetailsConfigPage.openStatusEditModal(statusVisibilityTestData.title);
        await caseDetailsConfigPage.toggleStatusVisibility();
        await caseDetailsConfigPage.saveStatus();

        // Assert
        await caseDetailsConfigPage.assertStatusVisibilityInList(
          statusVisibilityTestData.title,
          false
        );
      });

      test('Toggle status visibility back to visible', async () => {
        // Act
        await caseDetailsConfigPage.openStatusEditModal(statusVisibilityTestData.title);
        await caseDetailsConfigPage.toggleStatusVisibility();
        await caseDetailsConfigPage.saveStatus();

        // Assert
        await caseDetailsConfigPage.assertStatusVisibilityInList(
          statusVisibilityTestData.title,
          true
        );
      });

      test('Clean up visibility test status', async () => {
        await caseDetailsConfigPage.deleteStatus(statusVisibilityTestData.title);
        await caseDetailsConfigPage.assertStatusNotExists(statusVisibilityTestData.title);
      });
    });

    test.describe('6.81 — Rearrange statuses', () => {
      test('Add two statuses for reordering', async () => {
        // Arrange - add status A then status B
        await caseDetailsConfigPage.addStatus(statusReorderTestData.titleA);
        await caseDetailsConfigPage.assertStatusExists(statusReorderTestData.titleA);

        await caseDetailsConfigPage.addStatus(statusReorderTestData.titleB);
        await caseDetailsConfigPage.assertStatusExists(statusReorderTestData.titleB);
      });

      test('Drag status B above status A', async () => {
        // Arrange - capture initial order
        const initialOrder = await caseDetailsConfigPage.getStatusTitlesInOrder();
        const indexA = initialOrder.indexOf(statusReorderTestData.titleA);
        const indexB = initialOrder.indexOf(statusReorderTestData.titleB);
        expect(indexA).toBeLessThan(indexB);

        // Act - drag B to A's position
        await caseDetailsConfigPage.dragStatusToPosition(
          statusReorderTestData.titleB,
          statusReorderTestData.titleA
        );

        // Assert - B should now be before A
        const newOrder = await caseDetailsConfigPage.getStatusTitlesInOrder();
        const newIndexA = newOrder.indexOf(statusReorderTestData.titleA);
        const newIndexB = newOrder.indexOf(statusReorderTestData.titleB);
        expect(newIndexB).toBeLessThan(newIndexA);
      });

      test('Clean up reorder test statuses', async () => {
        await caseDetailsConfigPage.deleteStatus(statusReorderTestData.titleA);
        await caseDetailsConfigPage.assertStatusNotExists(statusReorderTestData.titleA);

        await caseDetailsConfigPage.deleteStatus(statusReorderTestData.titleB);
        await caseDetailsConfigPage.assertStatusNotExists(statusReorderTestData.titleB);
      });
    });
  });

  test.describe('6.82–6.84 — Tags', () => {
    test.describe('Success', () => {
      test('Add a tag', async () => {
        // Arrange
        await caseDetailsConfigPage.switchToTagsTab();

        // Act
        await caseDetailsConfigPage.addTag(tagTestData.title);

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

    test.describe('6.84 — Set tag color', () => {
      test('Add a tag and set its color', async () => {
        // Arrange
        await caseDetailsConfigPage.addTag(tagColorTestData.title);
        await caseDetailsConfigPage.assertTagExists(tagColorTestData.title);

        // Act — Edit the tag and change color to 'Red'
        await caseDetailsConfigPage.openTagEditModal(tagColorTestData.title);
        await caseDetailsConfigPage.selectTagColor('Red');
        await caseDetailsConfigPage.saveTag();

        // Assert — verify color tag in the list shows 'Red'
        await caseDetailsConfigPage.assertTagColorInList(tagColorTestData.title, 'Red');
      });

      test('Change tag color to a different value', async () => {
        // Act — Edit again and change to 'Green'
        await caseDetailsConfigPage.openTagEditModal(tagColorTestData.title);
        await caseDetailsConfigPage.selectTagColor('Green');
        await caseDetailsConfigPage.saveTag();

        // Assert
        await caseDetailsConfigPage.assertTagColorInList(tagColorTestData.title, 'Green');
      });

      test('Clean up color test tag', async () => {
        await caseDetailsConfigPage.deleteTag(tagColorTestData.title);
        await caseDetailsConfigPage.assertTagNotExists(tagColorTestData.title);
      });
    });
  });
});
