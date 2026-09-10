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
import {CaseDetailsManagementPage, CaseHandlerSettings} from './page';
import {expectNotificationMessage} from '../../utils/ui.utils';
import {apiGet, apiPut, apiPatch, apiDelete} from '../../utils/api.utils';
import {
  ensureDraftVersionSelected,
  ensureFinalVersionSelected,
  getVersionFromUrl,
} from '../../utils/version.utils';

test.use({storageState: undefined});

test.describe('Case management', () => {
  let context;
  let page;
  let caseDetailsManagementPage;
  let request;
  let draftVersion: string;

  test.describe.configure({timeout: 90_000});

  // Arrange
  test.beforeAll(async ({browser, baseURL}) => {
    // Create shared context & page
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    caseDetailsManagementPage = new CaseDetailsManagementPage(page, request);

    await caseDetailsManagementPage.goToCaseDetailsManagement('bezwaar');
    draftVersion = await ensureDraftVersionSelected(page);
  });

  test.describe('Success test', () => {
    test.describe('6.36–6.38 — Version switch', () => {
      test('Switch version via dropdown', async () => {
        // Arrange: ensure we're on a final version first so we actually switch
        const stableVersion = await ensureFinalVersionSelected(page);

        // Act
        await caseDetailsManagementPage.switchCaseVersionViaDropdown(draftVersion);

        // Assert
        await expect(page).toHaveURL(
          `/case-management/case/bezwaar/version/${draftVersion}/general`
        );
      });

      test('Switch version via list', async () => {
        // Act
        await caseDetailsManagementPage.switchCaseVersionViaList();

        // Assert
        await expect(page).toHaveURL(
          /\/case-management\/case\/bezwaar\/version\/[\d.]+\/general/
        );
      });

      test('Set active version', async () => {
        // Act
        const stableVersion = await ensureFinalVersionSelected(page);
        if (await caseDetailsManagementPage.makeVersionGlobal(stableVersion)) {
          await expect(
            caseDetailsManagementPage.versionSelectDropdown.locator('cds-tag', {
              hasText: 'Globally active',
            })
          ).toBeVisible();
        }
      });
    });

    test.describe('General tab', () => {
      test.beforeEach(async () => {
        draftVersion = await caseDetailsManagementPage.openDraftVersionWithSettings();
      });

      test.describe('6.2, 6.3 — Case handler', () => {
        let originalHandlerSettings: CaseHandlerSettings | null = null;
        let settingsUrl: string | null = null;

        test.beforeAll(async () => {
          settingsUrl = `/api/management/v1/case-definition/bezwaar/version/${draftVersion}/settings`;
          try {
            originalHandlerSettings = await apiGet<CaseHandlerSettings>(settingsUrl);
          } catch {
            originalHandlerSettings = null;
          }
        });

        test.afterAll(async () => {
          if (!originalHandlerSettings || !settingsUrl) return;

          try {
            await apiPatch(settingsUrl, {
              canHaveAssignee: originalHandlerSettings.canHaveAssignee,
              autoAssignTasks: originalHandlerSettings.autoAssignTasks,
            });
          } catch (error) {
            console.warn(
              `[case-details-management] Could not restore the case handler settings on ` +
                `${settingsUrl}; \`user-cases\` may fail as a result: ${(error as Error).message}`
            );
          }
        });

        test('Can have handler is false', async () => {
          const canHaveHandler = caseDetailsManagementPage.caseHandlerCanHaveHandlerToggle;
          const autoAssign = caseDetailsManagementPage.caseHandlerAutomaticallyAssignToggle;

          await caseDetailsManagementPage.setCaseHandlerSettingsViaApi({
            canHaveAssignee: true,
            autoAssignTasks: false,
          });

          //Act
          await caseDetailsManagementPage.setCanHaveHandler(false);

          //Assert
          await canHaveHandler.assertChecked(false);
          await autoAssign.assertDisabled();
        });

        test('Can have handler is true & cannot automatically assign', async () => {
          const canHaveHandler = caseDetailsManagementPage.caseHandlerCanHaveHandlerToggle;
          const autoAssign = caseDetailsManagementPage.caseHandlerAutomaticallyAssignToggle;

          await caseDetailsManagementPage.setCaseHandlerSettingsViaApi({
            canHaveAssignee: false,
            autoAssignTasks: false,
          });

          //Act
          await caseDetailsManagementPage.setCanHaveHandler(true);

          // Assert
          await canHaveHandler.assertChecked(true);
          await autoAssign.assertEnabled();
          await autoAssign.assertChecked(false);
        });

        test('Can have handler is true & can automatically assign', async () => {
          const canHaveHandler = caseDetailsManagementPage.caseHandlerCanHaveHandlerToggle;
          const autoAssign = caseDetailsManagementPage.caseHandlerAutomaticallyAssignToggle;

          // Arrange: auto-assign is only editable while the case can have a handler
          await caseDetailsManagementPage.setCaseHandlerSettingsViaApi({
            canHaveAssignee: true,
            autoAssignTasks: false,
          });
          await canHaveHandler.assertChecked(true);
          await autoAssign.assertEnabled();

          //Act
          await caseDetailsManagementPage.setAutomaticallyAssign(true);

          //Assert
          await autoAssign.assertChecked(true);
        });

        test('Turning the handler off also clears auto-assign', async () => {
          const autoAssign = caseDetailsManagementPage.caseHandlerAutomaticallyAssignToggle;

          await caseDetailsManagementPage.setCaseHandlerSettingsViaApi({
            canHaveAssignee: true,
            autoAssignTasks: true,
          });
          await autoAssign.assertChecked(true);

          //Act
          await caseDetailsManagementPage.setCanHaveHandler(false);

          await autoAssign.assertDisabled();
          expect(
            await caseDetailsManagementPage.getCaseHandlerSettingsViaApi()
          ).toMatchObject({canHaveAssignee: false, autoAssignTasks: false});
        });
      });

      test.describe('6.4, 6.5 — External start form', () => {
        test('Start form enabled', async () => {
          //Arrange
          await caseDetailsManagementPage.hasExternalFormToggle.click();
          await expect(caseDetailsManagementPage.hasExternalForm).toHaveAttribute(
            'aria-checked',
            'true'
          );

          //Act
          await caseDetailsManagementPage.fillInExternalForm();

          //Assert
          await expectNotificationMessage(
            page,
            'External start form configuration updated successfully',
            {
              exact: true,
            }
          );
        });

        test('Start form disabled', async () => {
          //Act
          await caseDetailsManagementPage.hasExternalFormToggle.click();
          await expect(caseDetailsManagementPage.hasExternalForm).toHaveAttribute(
            'aria-checked',
            'false'
          );
          await caseDetailsManagementPage.externalFormSave.click();

          //Assert
          await expect(caseDetailsManagementPage.externalFormUrl).toBeEmpty();
          await expect(caseDetailsManagementPage.externalFormDescription).toBeEmpty();

          await expectNotificationMessage(
            page,
            'External start form configuration updated successfully',
            {
              exact: true,
            }
          );
        });
      });

      test.describe('6.1 — Link upload process', () => {
        let originalUploadProcessKey: string | null;
        let featureProcessUrl: string | null = null;

        test.beforeAll(async () => {
          featureProcessUrl = `/api/management/v1/case-definition/bezwaar/version/${draftVersion}/feature-process`;
          try {
            const linked = await apiGet<{processDefinitionKey: string}>(
              `${featureProcessUrl}/DOCUMENT_UPLOAD`
            );
            originalUploadProcessKey = linked?.processDefinitionKey ?? null;
          } catch {
            originalUploadProcessKey = null;
          }
        });

        test.afterAll(async () => {
          if (!featureProcessUrl) return;

          try {
            if (originalUploadProcessKey) {
              await apiPut(featureProcessUrl, {
                processDefinitionKey: originalUploadProcessKey,
                linkType: 'DOCUMENT_UPLOAD',
              });
            } else {
              await apiDelete(`${featureProcessUrl}/DOCUMENT_UPLOAD`);
            }
          } catch (error) {
            console.warn(
              `[case-details-management] Could not restore the upload process link on ` +
                `${featureProcessUrl}: ${(error as Error).message}`
            );
          }
        });

        test('Upload process combo box is visible', async () => {
          await expect(caseDetailsManagementPage.linkUploadProcessComboBox).toBeVisible();
        });

        test('Can select an upload process', async () => {
          // Arrange: clear any existing selection first
          const currentValue = await caseDetailsManagementPage.linkUploadProcessInput.inputValue();
          if (currentValue) {
            await caseDetailsManagementPage.clearUploadProcess();
            await expect(caseDetailsManagementPage.linkUploadProcessInput).toHaveValue('');
          }

          // Act
          await caseDetailsManagementPage.selectUploadProcess('Bezwaar');

          // Assert
          await expect(caseDetailsManagementPage.linkUploadProcessInput).toHaveValue('Bezwaar');
        });

        test('Can change the linked upload process', async () => {
          // Act
          await caseDetailsManagementPage.selectUploadProcess('Documenten API upload document');

          // Assert
          await expect(caseDetailsManagementPage.linkUploadProcessInput).toHaveValue(
            'Documenten API upload document'
          );
        });

        test('Can clear the linked upload process', async () => {
          // Arrange: ensure a process is linked
          const currentValue = await caseDetailsManagementPage.linkUploadProcessInput.inputValue();
          if (!currentValue) {
            await caseDetailsManagementPage.selectUploadProcess('Bezwaar');
            await expect(caseDetailsManagementPage.linkUploadProcessInput).toHaveValue('Bezwaar');
          }

          // Act
          await caseDetailsManagementPage.clearUploadProcess();

          // Assert
          await expect(caseDetailsManagementPage.linkUploadProcessInput).toHaveValue('');
        });
      });

      test('Read-only states', async () => {
        //Act
        await ensureFinalVersionSelected(page);

        //Assert
        await caseDetailsManagementPage.caseHandlerCanHaveHandlerToggle.assertDisabled();
        await caseDetailsManagementPage.caseHandlerAutomaticallyAssignToggle.assertDisabled();
        await expect(caseDetailsManagementPage.hasExternalForm).toBeDisabled();
        await expect(caseDetailsManagementPage.externalFormUrl).toBeDisabled();
        await expect(caseDetailsManagementPage.externalFormDescription).toBeDisabled();
      });
    });

    test('Export case definition', async () => {
      //Act
      const stableVersion = await ensureFinalVersionSelected(page);
      const download = await caseDetailsManagementPage.exportCaseDefinition();

      //Assert
      expect(download.suggestedFilename()).toContain(stableVersion);
    });
  });
});
