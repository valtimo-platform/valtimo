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
import {CASE_VERSIONS} from './case-config';
import {CaseDetailsManagementPage} from './page';
import {expectNotificationMessage} from '../../utils/ui.utils';

test.use({storageState: undefined});

test.describe('Case management', () => {
  let context;
  let page;
  let caseDetailsManagementPage;
  let request;

  // Arrange
  test.beforeAll(async ({browser, baseURL}) => {
    // Create shared context & page
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    caseDetailsManagementPage = new CaseDetailsManagementPage(page, request);

    await page.goto('/');
    await caseDetailsManagementPage.goToCaseDetailsManagement('bezwaar');
  });

  test.describe('Success test', () => {
    test.describe('Version switch', () => {
      test('Switch version via dropdown', async () => {
        // Act
        await caseDetailsManagementPage.switchCaseVersionViaDropdown(CASE_VERSIONS.DRAFT);

        // Assert
        expect(page).toHaveURL(
          `/case-management/case/bezwaar/version/${CASE_VERSIONS.STABLE}/general`
        );
      });

      test('Switch version via list', async () => {
        // Act
        await caseDetailsManagementPage.switchCaseVersionViaList(CASE_VERSIONS.STABLE);

        // Assert
        expect(page).toHaveURL(
          `/case-management/case/bezwaar/version/${CASE_VERSIONS.STABLE}/general`
        );
      });

      test('Set active version', async () => {
        //Act
        await caseDetailsManagementPage.makeVersionGlobal(CASE_VERSIONS.STABLE);

        //Assert
        await expect(
          caseDetailsManagementPage.versionSelectDropdown.locator('cds-tag', {
            hasText: 'Globally active',
          })
        ).toBeVisible();
      });
    });

    test.describe('General tab', () => {
      test.beforeEach(async () => {
        //Arrange
        await caseDetailsManagementPage.switchCaseVersionViaDropdown(CASE_VERSIONS.DRAFT);
        await page.reload();
        await page.waitForLoadState('domcontentloaded');
      });

      test.describe('Case handler', () => {
        test('Can have handler is false', async () => {
          // Arrange: ensure toggle starts as true so clicking it sets it to false
          const checked = await caseDetailsManagementPage.caseHandlerCanHaveHandler.getAttribute('ng-reflect-checked');
          if (checked === 'false') {
            await caseDetailsManagementPage.caseHandlerCanHaveHandlerToggle.click();
          }

          //Act
          await caseDetailsManagementPage.caseHandlerCanHaveHandlerToggle.click();

          //Assert
          await expect(caseDetailsManagementPage.caseHandlerCanHaveHandler).toHaveAttribute(
            'ng-reflect-checked',
            'false'
          );
          await expect(caseDetailsManagementPage.caseHandlerAutomaticallyAssign).toHaveAttribute(
            'ng-reflect-disabled',
            'true'
          );
        });

        test('Can have handler is true & cannot automatically assign', async () => {
          // Arrange: ensure toggle starts as false so clicking it sets it to true
          const checked = await caseDetailsManagementPage.caseHandlerCanHaveHandler.getAttribute('ng-reflect-checked');
          if (checked === 'true') {
            await caseDetailsManagementPage.caseHandlerCanHaveHandlerToggle.click();
          }

          //Act
          await caseDetailsManagementPage.caseHandlerCanHaveHandlerToggle.click();

          // Assert
          await expect(caseDetailsManagementPage.caseHandlerCanHaveHandler).toHaveAttribute(
            'ng-reflect-checked',
            'true'
          );
          await expect(caseDetailsManagementPage.caseHandlerAutomaticallyAssign).toHaveAttribute(
            'ng-reflect-disabled',
            'false'
          );
          await expect(caseDetailsManagementPage.caseHandlerAutomaticallyAssign).toHaveAttribute(
            'ng-reflect-checked',
            'false'
          );
        });

        test('Can have handler is true & can automatically assign', async () => {
          // Arrange: ensure canHaveHandler is true before testing auto-assign
          const checked = await caseDetailsManagementPage.caseHandlerCanHaveHandler.getAttribute('ng-reflect-checked');
          if (checked === 'false') {
            await caseDetailsManagementPage.caseHandlerCanHaveHandlerToggle.click();
          }

          // Assert canHaveHandler is true
          await expect(caseDetailsManagementPage.caseHandlerCanHaveHandler).toHaveAttribute(
            'ng-reflect-checked',
            'true'
          );
          await expect(caseDetailsManagementPage.caseHandlerAutomaticallyAssign).toHaveAttribute(
            'ng-reflect-enabled',
            'true'
          );

          await caseDetailsManagementPage.caseHandlerAutomaticallyAssignToggle.click();

          await expect(caseDetailsManagementPage.caseHandlerAutomaticallyAssign).toHaveAttribute(
            'ng-reflect-checked',
            'true'
          );
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

      test('Read-only states', async () => {
        //Act
        await caseDetailsManagementPage.switchCaseVersionViaDropdown(CASE_VERSIONS.STABLE);

        //Assert
        await expect(caseDetailsManagementPage.caseHandlerCanHaveHandler).toHaveAttribute(
          'ng-reflect-is-read-only',
          'true'
        );
        await expect(caseDetailsManagementPage.caseHandlerAutomaticallyAssign).toHaveAttribute(
          'ng-reflect-is-read-only',
          'true'
        );
        await expect(caseDetailsManagementPage.hasExternalForm).toHaveAttribute('disabled');
        await expect(caseDetailsManagementPage.externalFormUrl).toHaveAttribute(
          'ng-reflect-is-read-only',
          'true'
        );
        await expect(caseDetailsManagementPage.externalFormDescription).toHaveAttribute(
          'ng-reflect-is-read-only',
          'true'
        );
      });
    });

    test('Export case definition', async () => {
      //Act
      await caseDetailsManagementPage.switchCaseVersionViaDropdown(CASE_VERSIONS.STABLE);
      const download = await caseDetailsManagementPage.exportCaseDefinition();

      //Assert
      expect(download.suggestedFilename()).toContain(CASE_VERSIONS.STABLE);
    });
  });
});
