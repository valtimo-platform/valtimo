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
import {ensureDraftVersionSelected} from '../../../../../../../utils/version.utils';
import {CaseDetailsManagementZgwGeneralPage} from './page';
import {DocumentObjectenApiSync, ObjectManagementConfiguration} from './case-sync.types';
import {PluginConfiguration, ZaakType, ZaakTypeLink} from './case-type-link.types';

test.use({storageState: undefined});

const CASE_KEY = 'bezwaar';

test.describe('Case details management — ZGW General (6P)', () => {
  let context;
  let page;
  let request;
  let testPage: CaseDetailsManagementZgwGeneralPage;
  let draftVersion: string;

  let originalSync: DocumentObjectenApiSync | null = null;
  let originalLink: ZaakTypeLink | null = null;

  let objectManagementConfigs: ObjectManagementConfiguration[] = [];
  let zaakTypes: ZaakType[] = [];
  let zakenApiPlugins: PluginConfiguration[] = [];

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;
    testPage = new CaseDetailsManagementZgwGeneralPage(page, request);

    await page.goto('/');
    await testPage.goToCaseManagementForCase(CASE_KEY);
    draftVersion = await ensureDraftVersionSelected(page);

    originalSync = await testPage.getCaseSync(CASE_KEY, draftVersion);
    originalLink = await testPage.getCaseTypeLink(CASE_KEY, draftVersion);

    objectManagementConfigs = await testPage.getObjectManagementConfigurations();
    zaakTypes = await testPage.getZaakTypes();
    zakenApiPlugins = await testPage.getZakenApiPluginConfigurations();

    expect(objectManagementConfigs.length).toBeGreaterThan(0);
    expect(zaakTypes.length).toBeGreaterThan(0);
    expect(zakenApiPlugins.length).toBeGreaterThan(0);

    await testPage.openZgwGeneralTab();
  });

  test.afterAll(async () => {
    // Restore the sync configuration
    try {
      if (originalSync && originalSync.objectManagementConfigurationId) {
        await testPage.putCaseSync(CASE_KEY, draftVersion, {
          objectManagementConfigurationId: originalSync.objectManagementConfigurationId,
          enabled: originalSync.enabled,
        });
      } else {
        await testPage.deleteCaseSyncViaApi(CASE_KEY, draftVersion);
      }
    } catch {
      // Best-effort restore
    }

    // Restore the case type link
    try {
      if (originalLink && originalLink.zaakTypeUrl) {
        await testPage.deleteCaseTypeLinkViaApi(CASE_KEY, draftVersion);
        await testPage.postCaseTypeLink(CASE_KEY, draftVersion, {
          zaakTypeUrl: originalLink.zaakTypeUrl,
          zakenApiPluginConfigurationId: originalLink.zakenApiPluginConfigurationId,
          rsin: originalLink.rsin,
          createWithDossier: originalLink.createWithDossier ?? false,
        });
      } else {
        await testPage.deleteCaseTypeLinkViaApi(CASE_KEY, draftVersion);
      }
    } catch {
      // Best-effort restore
    }

    await context.close();
  });

  test.describe('6.98 — Configure case sync', () => {
    test('Toggle the enabled flag on an existing sync and persist the change', async () => {
      // Ensure a sync exists on the draft for this test
      if (!originalSync || !originalSync.objectManagementConfigurationId) {
        const seed = objectManagementConfigs[0];
        await testPage.putCaseSync(CASE_KEY, draftVersion, {
          objectManagementConfigurationId: seed.id,
          enabled: true,
        });
        await page.reload();
        await ensureDraftVersionSelected(page);
        await testPage.openZgwGeneralTab();
      }

      const before = await testPage.getCaseSync(CASE_KEY, draftVersion);
      expect(before?.objectManagementConfigurationId).toBeTruthy();

      await testPage.openCaseSyncEditModal();
      await testPage.toggleCaseSyncEnabled();
      await testPage.submitCaseSyncModal();

      const after = await testPage.getCaseSync(CASE_KEY, draftVersion);
      expect(after?.enabled).toBe(!before?.enabled);
      await testPage.assertCaseSyncEnabledText(after?.enabled ? 'Yes' : 'No');
    });

    test('Delete the sync and reconfigure it from scratch via the UI', async () => {
      // Pick a configuration to link — any available one
      const targetConfig = objectManagementConfigs[0];

      await testPage.deleteCaseSync();
      // Verify nothing is persisted after delete
      expect(await testPage.getCaseSync(CASE_KEY, draftVersion)).toBeNull();

      await testPage.openCaseSyncAddModal();
      await testPage.selectCaseSyncConfig(targetConfig.title);
      await testPage.submitCaseSyncModal();

      await testPage.assertCaseSyncConfigTitle(targetConfig.title);

      const persisted = await testPage.getCaseSync(CASE_KEY, draftVersion);
      expect(persisted?.objectManagementConfigurationId).toBe(targetConfig.id);
    });

    test.describe('Failure scenarios', () => {
      test('Submit is disabled when no object management configuration is selected', async () => {
        await testPage.deleteCaseSyncViaApi(CASE_KEY, draftVersion);
        await page.reload();
        await ensureDraftVersionSelected(page);
        await testPage.openZgwGeneralTab();

        await testPage.openCaseSyncAddModal();
        await testPage.assertCaseSyncSubmitDisabled();
        await testPage.caseSyncModalCancelButton.click();
        await expect(testPage.caseSyncEnabledCheckbox).not.toBeVisible();
      });
    });
  });

  test.describe('6.99/6.100/6.101 — Case type link', () => {
    test('6.100 — Edit an existing case type link and persist the change', async () => {
      // Ensure a link exists before editing
      const current = await testPage.getCaseTypeLink(CASE_KEY, draftVersion);
      if (!current) {
        const zaakType = zaakTypes[0];
        const plugin = zakenApiPlugins[0];
        await testPage.postCaseTypeLink(CASE_KEY, draftVersion, {
          zaakTypeUrl: zaakType.url,
          zakenApiPluginConfigurationId: plugin.id,
          rsin: '123456782',
          createWithDossier: false,
        });
        await page.reload();
        await ensureDraftVersionSelected(page);
        await testPage.openZgwGeneralTab();
      }

      const NEW_RSIN = '002564440';

      await testPage.openCaseTypeLinkEditModal();
      await testPage.fillRsin(NEW_RSIN);
      await testPage.submitCaseTypeLinkModal();

      await testPage.assertCaseTypeLinkRsinValue(NEW_RSIN);

      const persisted = await testPage.getCaseTypeLink(CASE_KEY, draftVersion);
      expect(persisted?.rsin).toBe(NEW_RSIN);
    });

    test('6.101 — Delete the case type link and verify the Link button is shown', async () => {
      // Make sure a link exists to delete
      if (!(await testPage.getCaseTypeLink(CASE_KEY, draftVersion))) {
        const zaakType = zaakTypes[0];
        const plugin = zakenApiPlugins[0];
        await testPage.postCaseTypeLink(CASE_KEY, draftVersion, {
          zaakTypeUrl: zaakType.url,
          zakenApiPluginConfigurationId: plugin.id,
          rsin: '123456782',
          createWithDossier: false,
        });
        await page.reload();
        await ensureDraftVersionSelected(page);
        await testPage.openZgwGeneralTab();
      }

      await testPage.deleteCaseTypeLink();
      expect(await testPage.getCaseTypeLink(CASE_KEY, draftVersion)).toBeNull();
    });

    test('6.99 — Link a case type through the modal and verify the tile reflects it', async () => {
      if (await testPage.getCaseTypeLink(CASE_KEY, draftVersion)) {
        await testPage.deleteCaseTypeLinkViaApi(CASE_KEY, draftVersion);
        await page.reload();
        await ensureDraftVersionSelected(page);
        await testPage.openZgwGeneralTab();
      }

      const zaakType = zaakTypes[0];
      const plugin = zakenApiPlugins[0];
      const NEW_RSIN = '123456782';

      await testPage.openCaseTypeLinkLinkModal();
      await testPage.selectZaakTypeByUrl(zaakType.url);
      await testPage.selectPluginById(plugin.id);
      await testPage.fillRsin(NEW_RSIN);
      await testPage.submitCaseTypeLinkModal();

      await testPage.assertCaseTypeLinkTitle(zaakType.omschrijving);
      await testPage.assertCaseTypeLinkRsinValue(NEW_RSIN);

      const persisted = await testPage.getCaseTypeLink(CASE_KEY, draftVersion);
      expect(persisted?.zaakTypeUrl).toBe(zaakType.url);
      expect(persisted?.rsin).toBe(NEW_RSIN);
    });

    test.describe('Failure scenarios', () => {
      test('Save is disabled when no zaak type is selected', async () => {
        // Delete any existing link to surface the Link button
        await testPage.deleteCaseTypeLinkViaApi(CASE_KEY, draftVersion);
        await page.reload();
        await ensureDraftVersionSelected(page);
        await testPage.openZgwGeneralTab();

        await testPage.openCaseTypeLinkLinkModal();
        await testPage.assertCaseTypeLinkSubmitDisabled();
        await testPage.caseTypeLinkModalCancelButton.click();
        await expect(testPage.caseTypeLinkZaakTypeSelect).not.toBeVisible();
      });
    });
  });
});
