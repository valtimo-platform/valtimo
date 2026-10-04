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
import {UserCasesPage} from './page';
import {USER_CASES_CONFIG} from './user-cases-config';

const FILES = ['bezwaarschrift.txt', 'bijlage_1.txt', 'machtiging.txt'];

test.use({storageState: 'playwright/.auth/uiState.json'});

test.describe('Case details — Documents tab, upload several documents at once (gzac-issues#319)', () => {
  let userCasesPage: UserCasesPage;
  let documentId: string;

  test.beforeEach(async ({page}) => {
    test.setTimeout(90_000);
    userCasesPage = new UserCasesPage(page);
    documentId = (await userCasesPage.createCaseViaApi()).documentId;
  });

  test.afterEach(async () => {
    await userCasesPage.deleteCaseViaApi(documentId);
  });

  test('One pick of three files, one metadata form, three documents', async ({page}) => {
    await userCasesPage.goToCaseDetail(documentId);
    await userCasesPage.detailTab(USER_CASES_CONFIG.detailTabs.documents).click();
    const tab = userCasesPage.documentsTabContainer.first();
    const uploadButton = tab.getByRole('button', {name: 'Upload'});
    await expect(uploadButton).toBeEnabled({timeout: 15_000});

    const chooserPromise = page.waitForEvent('filechooser');
    await uploadButton.click();
    const chooser = await chooserPromise;
    expect(chooser.isMultiple()).toBe(true);
    await chooser.setFiles(
      FILES.map(name => ({name, mimeType: 'text/plain', buffer: Buffer.from(`e2e ${name}`)}))
    );

    const modal = page.locator('valtimo-documenten-api-metadata-modal');
    await expect(modal.getByText(`Add metadata for ${FILES.length} files`)).toBeVisible();
    for (const name of FILES) {
      await expect(modal.getByText(name, {exact: true})).toBeVisible();
    }
    await expect(modal.locator('#bestandsnaam')).toHaveCount(0);
    await expect(modal.locator('#titel')).toHaveCount(0);

    await modal.locator('#informatieobjecttype input').click();
    await modal.locator('#informatieobjecttype [role="option"]').first().click();

    const uploads: number[] = [];
    page.on('response', response => {
      if (/\/api\/v1\/uploadprocess\/document\//.test(response.url())) uploads.push(response.status());
    });
    await modal.getByRole('button', {name: 'Save'}).click();

    await expect(modal.getByRole('button', {name: 'Save'})).toBeHidden({timeout: 30_000});
    await expect.poll(() => uploads, {timeout: 15_000}).toEqual([204, 204, 204]);
    for (const name of FILES) {
      await expect(tab.getByText(name, {exact: true})).toBeVisible({timeout: 15_000});
    }
  });
});
