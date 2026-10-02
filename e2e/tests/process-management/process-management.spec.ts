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
import {expectNotificationMessage} from '../../utils/ui.utils';
import {ProcessManagementPage} from './page';
import {
  CREATED_PROCESS,
  PROCESS_MANAGEMENT_TEXTS,
  UPLOADED_PROCESS,
} from './process-management-config';

test.use({storageState: undefined});

/**
 * Feature 7 — Process Management: the standalone `/processes` admin page.
 *
 * This is the *independent* process context: process definitions that are not
 * linked to a case definition. The case-scoped equivalent (the Processes tab of a
 * case) is covered by `case-details-management-processes.spec.ts`; the two share
 * the same list and builder components but differ in routing, available columns,
 * header actions (only the standalone context has version management) and API
 * endpoints.
 *
 * The suite builds up its own state in order: upload seeds version 1 of
 * `e2e-test-process`, the edit test saves version 2, and the version tests then
 * exercise the dropdown against those two versions.
 */
test.describe('Process management — standalone processes', () => {
  let context;
  let page;
  let request;
  let processPage: ProcessManagementPage;

  /** Every process key this suite may create, deleted in `afterAll`. */
  const createdProcessKeys: string[] = [UPLOADED_PROCESS.key, CREATED_PROCESS.key];

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    processPage = new ProcessManagementPage(page, request);

    await page.goto('/');

    // Remove leftovers from an interrupted previous run: a stale
    // `e2e-test-process` would turn the first upload into a replace flow and
    // shift every version number the version tests assert on.
    for (const key of createdProcessKeys) {
      await processPage.deleteProcessViaApi(key);
    }

    await processPage.goToProcessManagement();
  });

  test.afterAll(async () => {
    for (const key of createdProcessKeys) {
      await processPage.deleteProcessViaApi(key);
    }

    await context.close();
  });

  test.describe('7.1 — View process overview', () => {
    test('7.1 — Process list is visible with its toolbar actions', async () => {
      await processPage.goToProcessManagement();
      await processPage.assertListLoaded();
    });

    test('7.1 — Process list shows the Name, Key and Status columns', async () => {
      await processPage.goToProcessManagement();
      await processPage.assertColumnHeaders(PROCESS_MANAGEMENT_TEXTS.listColumns);
    });

    test('7.1 — Process list shows every unlinked process returned by the API', async () => {
      const processes = await processPage.getProcessesViaApi();

      await processPage.goToProcessManagement();

      await expect(processPage.carbonList.rows).toHaveCount(processes.length);

      for (const process of processes) {
        await processPage.assertProcessVisible(process.processDefinition.key);
      }
    });
  });

  test.describe('7.4 — Deploy a process definition', () => {
    test('7.4 — Deploys a BPMN file and lists the new process', async () => {
      const response = await processPage.uploadProcess(UPLOADED_PROCESS.fileName);
      // The deploy endpoints answer 204 No Content on success, so assert on
      // success rather than on a specific status code.
      expect(response.ok()).toBe(true);

      await expectNotificationMessage(page, PROCESS_MANAGEMENT_TEXTS.uploadSuccess);

      // Deployed as a single version, through the standalone (unlinked) endpoint.
      const versions = await processPage.getProcessVersionsViaApi(UPLOADED_PROCESS.key);
      expect(versions).toHaveLength(1);
      expect(versions[0].processDefinition).toMatchObject({
        key: UPLOADED_PROCESS.key,
        name: UPLOADED_PROCESS.name,
        version: 1,
      });

      // And listed in the overview with its name and key.
      await processPage.goToProcessManagement();
      await processPage.assertProcessMetadata({
        name: UPLOADED_PROCESS.name,
        key: UPLOADED_PROCESS.key,
      });
    });

    test.describe('Failure scenarios', () => {
      test('Upload cannot be submitted without a file', async () => {
        await processPage.openUploadModal();

        await expect(processPage.uploadSubmitButton).toBeDisabled();

        // Picking a file is the only thing that unlocks it.
        await processPage.selectBpmnFile(UPLOADED_PROCESS.fileName);
        await expect(processPage.uploadSubmitButton).toBeEnabled();

        await processPage.closeUploadModal();
      });

      test('Re-uploading the same key offers to replace instead of deploying a duplicate', async () => {
        const versionsBefore = await processPage.getProcessVersionsViaApi(UPLOADED_PROCESS.key);
        expect(versionsBefore.length).toBeGreaterThan(0);

        const response = await processPage.uploadProcess(UPLOADED_PROCESS.fileName);

        // The backend rejects the duplicate key and the UI turns the conflict into
        // an explicit replace confirmation rather than a failure toast.
        expect(response.status()).toBe(409);
        await expect(processPage.replaceModal).toBeVisible();
        await expect(processPage.replaceModal).toContainText(UPLOADED_PROCESS.key);

        // Declining leaves the deployment untouched.
        await processPage.replaceCancelButton.click();
        await expect(processPage.replaceModal).not.toBeVisible();
        await processPage.closeUploadModal();

        const versionsAfter = await processPage.getProcessVersionsViaApi(UPLOADED_PROCESS.key);
        expect(versionsAfter).toHaveLength(versionsBefore.length);
      });
    });
  });

  test.describe('7.3, 7.4, 7.5 — Edit, save and version an existing process', () => {
    test('7.5 — Version dropdown is disabled while the process has a single version', async () => {
      await processPage.goToProcessBuilder(UPLOADED_PROCESS.key);

      // Version management is exclusive to the standalone builder, but a single
      // deployed version leaves nothing to switch to.
      await expect(processPage.versionDropdownButton).toBeVisible();
      await expect(processPage.versionDropdownButton).toBeDisabled();
      await expect(processPage.versionDropdownButton).toContainText(
        `${PROCESS_MANAGEMENT_TEXTS.versionPrefix}1`
      );

      // The case-link toggles belong to the case context only.
      await expect(processPage.startsCaseToggle).not.toBeVisible();
      await expect(processPage.startableByUserToggle).not.toBeVisible();

      // An editable, non-system process carries neither status tag.
      await expect(processPage.readOnlyTag).not.toBeVisible();
      await expect(processPage.systemProcessTag).not.toBeVisible();

      // Export is offered from the header's overflow menu.
      await processPage.overflowMenu.open();
      await expect(processPage.exportOption).toBeVisible();
      await processPage.overflowMenu.close();

      // Nothing has changed yet, so there is nothing to save.
      await expect(processPage.deployButton).toBeDisabled();
    });

    test('7.3, 7.4 — Edits the BPMN and saves it as a new version', async () => {
      await processPage.goToProcessBuilder(UPLOADED_PROCESS.key);
      await expect(processPage.deployButton).toBeDisabled();

      // 7.3 — edit the diagram through the modeler.
      const initialTaskCount = await processPage.taskShapes.count();
      await processPage.appendTaskToStartEvent(UPLOADED_PROCESS.startEventId);
      await expect(processPage.taskShapes).toHaveCount(initialTaskCount + 1);

      // A pending change is what enables Save.
      await expect(processPage.deployButton).toBeEnabled();

      // The appended task has no outgoing flow and no process link, so a non-draft
      // deploy would be stopped by backend validation. Saving as a draft skips
      // validation, which is what this test is about.
      await processPage.draftToggle.enable();

      // 7.4 — save, which deploys a new version of the same key.
      const response = await processPage.saveProcess();
      expect(response.ok()).toBe(true);
      await expectNotificationMessage(page, PROCESS_MANAGEMENT_TEXTS.deploySuccess);

      const versions = await processPage.getProcessVersionsViaApi(UPLOADED_PROCESS.key);
      expect(versions).toHaveLength(2);
      expect(versions.map(version => version.processDefinition.version).sort()).toEqual([1, 2]);

      // Saving as a draft marks the process in the overview.
      await processPage.goToProcessManagement();
      await processPage.assertProcessHasDraftTag(UPLOADED_PROCESS.key);
    });

    test('7.5 — Version dropdown lists every version and switches between them', async () => {
      await processPage.goToProcessBuilder(UPLOADED_PROCESS.key);

      // The builder opens on the latest version.
      await expect(processPage.versionDropdownButton).toBeEnabled();
      await expect(processPage.versionDropdownButton).toContainText(
        `${PROCESS_MANAGEMENT_TEXTS.versionPrefix}2`
      );

      await processPage.openVersionDropdown();
      await expect(processPage.versionDropdown.getByRole('listbox').getByRole('option')).toHaveCount(
        2
      );
      await expect(processPage.versionOption(2)).toBeVisible();
      await expect(processPage.versionOption(1)).toBeVisible();

      // Switching version reloads that version's diagram into the modeler.
      await processPage.versionOption(1).click();
      await expect(processPage.versionDropdownButton).toContainText(
        `${PROCESS_MANAGEMENT_TEXTS.versionPrefix}1`
      );
      await expect(processPage.elementShape(UPLOADED_PROCESS.startEventId)).toBeVisible();

      // Switching version discards pending changes, so Save is disabled again.
      await expect(processPage.deployButton).toBeDisabled();
    });
  });

  test.describe('7.2 — Create a new process', () => {
    test('7.2 — Create process opens an empty diagram without version management', async () => {
      await processPage.goToCreateProcess();

      // A process that does not exist yet has no versions to manage.
      await expect(processPage.versionDropdown).not.toBeVisible();

      // The seeded diagram holds a single start event and nothing else.
      await expect(processPage.elementShape(CREATED_PROCESS.startEventId)).toBeVisible();
      await expect(processPage.taskShapes).toHaveCount(0);

      // Nothing drawn yet, so nothing to deploy.
      await expect(processPage.deployButton).toBeDisabled();
    });

    test.describe('Failure scenarios', () => {
      test('A new process that fails validation is not deployed', async () => {
        const versionsBefore = await processPage.getProcessVersionsViaApi(CREATED_PROCESS.key);

        await processPage.goToCreateProcess();
        await processPage.appendTaskToStartEvent(CREATED_PROCESS.startEventId);

        // Deploying without the draft toggle validates first. The appended task has
        // no outgoing sequence flow and no process link, so validation fails and
        // the deploy never happens.
        await processPage.draftToggle.disable();

        const validation = await processPage.saveExpectingValidation();
        const result = await validation.json();
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);

        // The failures are surfaced on the canvas and the user stays in the builder.
        await expect(processPage.validationErrors).toBeVisible();
        expect(page.url()).toContain('/processes/create');

        // And nothing was deployed.
        const versionsAfter = await processPage.getProcessVersionsViaApi(CREATED_PROCESS.key);
        expect(versionsAfter).toHaveLength(versionsBefore.length);
      });
    });

    test('7.2, 7.4 — Creates and deploys a new process definition', async () => {
      await processPage.goToCreateProcess();
      await processPage.appendTaskToStartEvent(CREATED_PROCESS.startEventId);
      await expect(processPage.deployButton).toBeEnabled();

      // Deploy as a draft so the incomplete diagram is accepted.
      await processPage.draftToggle.enable();

      const response = await processPage.deployNewProcess();
      expect(response.ok()).toBe(true);

      // Creating navigates back to the overview.
      await page.waitForURL(/\/processes$/);
      await expectNotificationMessage(page, PROCESS_MANAGEMENT_TEXTS.deploySuccess);
      await processPage.carbonList.waitForLoaded();

      // The new definition exists as version 1 and is listed as a draft. Its key
      // comes from the seeded empty diagram, and it has no name — hence the
      // key-based row lookup.
      const versions = await processPage.getProcessVersionsViaApi(CREATED_PROCESS.key);
      expect(versions).toHaveLength(1);
      expect(versions[0].processDefinition).toMatchObject({
        key: CREATED_PROCESS.key,
        version: 1,
      });

      await processPage.assertProcessVisible(CREATED_PROCESS.key);
      await processPage.assertProcessHasDraftTag(CREATED_PROCESS.key);
    });
  });

  test.describe('Delete a process definition', () => {
    test('Deletes a process and removes it from the overview', async () => {
      await processPage.goToProcessManagement();
      await processPage.assertProcessVisible(UPLOADED_PROCESS.key);

      const response = await processPage.deleteProcess(UPLOADED_PROCESS.key);
      expect(response.ok()).toBe(true);

      await expectNotificationMessage(page, PROCESS_MANAGEMENT_TEXTS.deleteSuccess);
      await processPage.assertProcessNotVisible(UPLOADED_PROCESS.key);

      // Deleting an unlinked process removes every deployed version of the key.
      const versions = await processPage.getProcessVersionsViaApi(UPLOADED_PROCESS.key);
      expect(versions).toHaveLength(0);
    });
  });
});
