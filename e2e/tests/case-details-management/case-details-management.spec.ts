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
import {CaseDetailsManagementPage} from './page';
import {expectNotificationMessage} from '../../utils/ui.utils';
import {apiGet, apiPut, apiDelete} from '../../utils/api.utils';
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

  // Arrange
  test.beforeAll(async ({browser, baseURL}) => {
    // Create shared context & page
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    caseDetailsManagementPage = new CaseDetailsManagementPage(page, request);

    await page.goto('/');
    await caseDetailsManagementPage.goToCaseDetailsManagement('bezwaar');
    draftVersion = await ensureDraftVersionSelected(page);
  });

  test.describe('Success test', () => {
    test.describe('Version switch', () => {
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
        //Arrange
        draftVersion = await ensureDraftVersionSelected(page);
        await page.reload();
        await page.waitForLoadState('load');
        // Wait for Angular to render the handler section with data from the API
        await caseDetailsManagementPage.caseHandlerCanHaveHandler
          .getByRole('switch')
          .waitFor({state: 'attached', timeout: 15_000});
      });

      test.describe('Case handler', () => {
        test('Can have handler is false', async () => {
          // Arrange: ensure toggle starts as true so clicking it sets it to false
          const canHaveHandlerSwitch = caseDetailsManagementPage.caseHandlerCanHaveHandler.getByRole('switch');
          const autoAssignSwitch = caseDetailsManagementPage.caseHandlerAutomaticallyAssign.getByRole('switch');

          if (!(await canHaveHandlerSwitch.isChecked())) {
            await caseDetailsManagementPage.caseHandlerCanHaveHandlerToggle.click();
          }

          //Act
          await caseDetailsManagementPage.caseHandlerCanHaveHandlerToggle.click();

          //Assert
          await expect(canHaveHandlerSwitch).not.toBeChecked();
          await expect(autoAssignSwitch).toBeDisabled();
        });

        test('Can have handler is true & cannot automatically assign', async () => {
          // Arrange: ensure toggle starts as false so clicking it sets it to true
          const canHaveHandlerSwitch = caseDetailsManagementPage.caseHandlerCanHaveHandler.getByRole('switch');
          const autoAssignSwitch = caseDetailsManagementPage.caseHandlerAutomaticallyAssign.getByRole('switch');

          if (await canHaveHandlerSwitch.isChecked()) {
            await caseDetailsManagementPage.caseHandlerCanHaveHandlerToggle.click();
          }

          //Act
          await caseDetailsManagementPage.caseHandlerCanHaveHandlerToggle.click();

          // Assert
          await expect(canHaveHandlerSwitch).toBeChecked();
          await expect(autoAssignSwitch).toBeEnabled();
          await expect(autoAssignSwitch).not.toBeChecked();
        });

        test('Can have handler is true & can automatically assign', async () => {
          // Arrange: ensure canHaveHandler is true before testing auto-assign
          const canHaveHandlerSwitch = caseDetailsManagementPage.caseHandlerCanHaveHandler.getByRole('switch');
          const autoAssignSwitch = caseDetailsManagementPage.caseHandlerAutomaticallyAssign.getByRole('switch');

          if (!(await canHaveHandlerSwitch.isChecked())) {
            await caseDetailsManagementPage.caseHandlerCanHaveHandlerToggle.click();
          }

          // Assert canHaveHandler is true
          await expect(canHaveHandlerSwitch).toBeChecked();
          await expect(autoAssignSwitch).toBeEnabled();

          await caseDetailsManagementPage.caseHandlerAutomaticallyAssignToggle.click();

          await expect(autoAssignSwitch).toBeChecked();
        });
      });

      test.describe('External start form', () => {
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

      test.describe('Link upload process', () => {
        let originalUploadProcessKey: string | null;

        const getFeatureProcessUrl = () =>
          `/api/management/v1/case-definition/bezwaar/version/${draftVersion}/feature-process`;

        test.beforeAll(async () => {
          try {
            const linked = await apiGet<{processDefinitionKey: string}>(
              `${getFeatureProcessUrl()}/DOCUMENT_UPLOAD`
            );
            originalUploadProcessKey = linked?.processDefinitionKey ?? null;
          } catch {
            originalUploadProcessKey = null;
          }
        });

        test.afterAll(async () => {
          try {
            if (originalUploadProcessKey) {
              await apiPut(getFeatureProcessUrl(), {
                processDefinitionKey: originalUploadProcessKey,
                linkType: 'DOCUMENT_UPLOAD',
              });
            } else {
              await apiDelete(`${getFeatureProcessUrl()}/DOCUMENT_UPLOAD`);
            }
          } catch {
            // Ignore cleanup errors
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
        await expect(caseDetailsManagementPage.caseHandlerCanHaveHandler.getByRole('switch')).toBeDisabled();
        await expect(caseDetailsManagementPage.caseHandlerAutomaticallyAssign.getByRole('switch')).toBeDisabled();
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
