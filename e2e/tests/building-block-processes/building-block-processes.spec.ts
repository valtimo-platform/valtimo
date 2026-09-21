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
import {generateId} from '../../utils/dataGenerator';
import {expectNotificationMessage} from '../../utils/ui.utils';
import {
  BUILDING_BLOCK_PROCESS_TEXTS,
  CREATED_PROCESS,
  TEST_BUILDING_BLOCK,
  UPLOADED_PROCESS,
} from './building-block-processes-config';
import {BuildingBlockProcessesPage, escapeForRegExp} from './page';

test.use({storageState: undefined});

/**
 * Feature 13D — the Processes tab of a building block.
 *
 * The tests share one building block and run in declaration order: the list
 * assertions need the freshly generated single main process, and the delete and
 * "make main" actions are only enabled once a second process exists.
 *
 * The read-only assertions use a *second*, finalized building block. Finalizing
 * cannot be undone and would block the process cleanup in `afterAll`, so the
 * building block the other tests write to is kept a draft throughout.
 */
test.describe('Building block management — processes (13D)', () => {
  let context;
  let page;
  let request;
  let processesPage: BuildingBlockProcessesPage;

  const uniqueId = generateId();
  const buildingBlockKey = `${TEST_BUILDING_BLOCK.keyPrefix}-${uniqueId}`;
  const buildingBlockName = `${TEST_BUILDING_BLOCK.namePrefix} ${uniqueId}`;
  const finalBuildingBlockKey = `${TEST_BUILDING_BLOCK.keyPrefix}-final-${uniqueId}`;
  const versionTag = TEST_BUILDING_BLOCK.versionTag;

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    processesPage = new BuildingBlockProcessesPage(page, request);

    // Created through the API so the UI tests start from a known state: a draft
    // version whose only process definition is the generated main one, which
    // carries the key and name of the building block itself.
    await processesPage.createBuildingBlockViaApi({
      key: buildingBlockKey,
      name: buildingBlockName,
      versionTag,
      description: TEST_BUILDING_BLOCK.description,
    });

    await processesPage.createBuildingBlockViaApi({
      key: finalBuildingBlockKey,
      name: `${buildingBlockName} (final)`,
      versionTag,
      description: TEST_BUILDING_BLOCK.description,
    });
    await processesPage.finalizeVersionViaApi(finalBuildingBlockKey, versionTag);

    await page.goto('/');
  });

  test.afterAll(async () => {
    // Every process definition added by these tests is removed again. The
    // generated main definition cannot be deleted, and neither can the building
    // blocks themselves — there is no DELETE endpoint for building block
    // definitions (see `deleteBuildingBlockViaApi`), so they stay behind.
    await processesPage.deleteAddedProcessesViaApi(buildingBlockKey, versionTag, buildingBlockKey);

    for (const key of [buildingBlockKey, finalBuildingBlockKey]) {
      await processesPage.deleteBuildingBlockViaApi(key, versionTag);
    }

    await context.close();
  });

  test.describe('13.30, 13.31 — View the processes list', () => {
    test('13.30, 13.31 — Lists the generated main process with its name, key and status', async () => {
      await processesPage.goToProcessesTab(buildingBlockKey, versionTag);

      await processesPage.assertColumnHeaders(BUILDING_BLOCK_PROCESS_TEXTS.columns);

      // Creating a building block generates its main process definition, named
      // and keyed after the building block.
      await processesPage.assertProcessMetadata({
        name: buildingBlockName,
        key: buildingBlockKey,
      });
      await processesPage.assertProcessTag(
        buildingBlockKey,
        BUILDING_BLOCK_PROCESS_TEXTS.mainProcessTag
      );

      // The list matches the API.
      const processes = await processesPage.getProcessesViaApi(buildingBlockKey, versionTag);
      expect(processes).toHaveLength(1);
      expect(processes[0]).toMatchObject({key: buildingBlockKey, main: true});
      await processesPage.carbonList.assertRowCount(1);
    });

    test.describe('Failure scenarios', () => {
      test('The only process cannot be deleted or re-marked as main', async () => {
        await processesPage.goToProcessesTab(buildingBlockKey, versionTag);

        const actions = await processesPage.readRowActions(buildingBlockKey);
        expect(actions).toEqual([
          BUILDING_BLOCK_PROCESS_TEXTS.markAsMainAction,
          BUILDING_BLOCK_PROCESS_TEXTS.deleteAction,
        ]);

        const row = processesPage.rowByKey(buildingBlockKey);
        // A building block must keep exactly one main process, so with a single
        // definition both actions are unavailable.
        await expect(
          row.actionMenuItem(BUILDING_BLOCK_PROCESS_TEXTS.markAsMainAction)
        ).toBeDisabled();
        await expect(row.actionMenuItem(BUILDING_BLOCK_PROCESS_TEXTS.deleteAction)).toBeDisabled();

        await processesPage.closeRowActionMenu();
      });
    });
  });

  test.describe('13.32 — Manage process definitions', () => {
    test('13.32 — Uploads a BPMN file as an additional process definition', async () => {
      await processesPage.goToProcessesTab(buildingBlockKey, versionTag);

      const response = await processesPage.uploadProcess(
        buildingBlockKey,
        versionTag,
        UPLOADED_PROCESS.fileName
      );
      expect(response.status()).toBe(204);

      await expectNotificationMessage(page, BUILDING_BLOCK_PROCESS_TEXTS.uploadSuccess);

      await processesPage.assertProcessMetadata({
        name: UPLOADED_PROCESS.name,
        key: UPLOADED_PROCESS.key,
      });
      // An uploaded process joins the building block as a regular definition.
      await processesPage.assertProcessHasNoTags(UPLOADED_PROCESS.key);

      const uploaded = await processesPage.getProcessByKeyViaApi(
        buildingBlockKey,
        versionTag,
        UPLOADED_PROCESS.key
      );
      expect(uploaded).toMatchObject({key: UPLOADED_PROCESS.key, main: false});
    });

    test.describe('Failure scenarios', () => {
      test('Upload stays disabled until a BPMN file is selected', async () => {
        await processesPage.goToProcessesTab(buildingBlockKey, versionTag);

        await processesPage.openUploadModal();
        await expect(processesPage.uploadFileUploader).toBeVisible();
        await expect(processesPage.uploadSubmitButton).toBeDisabled();

        await processesPage.selectBpmnFile(UPLOADED_PROCESS.fileName);
        await expect(processesPage.uploadSubmitButton).toBeEnabled();

        // Cancelling leaves the list untouched.
        await processesPage.closeUploadModal();
        const processes = await processesPage.getProcessesViaApi(buildingBlockKey, versionTag);
        expect(processes.filter(process => process.key === UPLOADED_PROCESS.key)).toHaveLength(1);
      });
    });

    test('13.32 — Marks the uploaded process as the main process', async () => {
      await processesPage.goToProcessesTab(buildingBlockKey, versionTag);

      const uploaded = await processesPage.getProcessByKeyViaApi(
        buildingBlockKey,
        versionTag,
        UPLOADED_PROCESS.key
      );
      const response = await processesPage.markProcessAsMain(
        buildingBlockKey,
        versionTag,
        UPLOADED_PROCESS.key,
        uploaded!.id
      );
      expect(response.status()).toBe(204);

      // The tag moves across with the flag.
      await processesPage.assertProcessTag(
        UPLOADED_PROCESS.key,
        BUILDING_BLOCK_PROCESS_TEXTS.mainProcessTag
      );
      await processesPage.assertProcessHasNoTags(buildingBlockKey);

      const processes = await processesPage.getProcessesViaApi(buildingBlockKey, versionTag);
      expect(processes.filter(process => process.main).map(process => process.key)).toEqual([
        UPLOADED_PROCESS.key,
      ]);
    });

    test('13.32 — Deletes a process definition after confirming', async () => {
      await processesPage.goToProcessesTab(buildingBlockKey, versionTag);

      // The generated process is no longer the main one, so it can be removed.
      const generated = await processesPage.getProcessByKeyViaApi(
        buildingBlockKey,
        versionTag,
        buildingBlockKey
      );

      await processesPage.openDeleteConfirmation(buildingBlockKey);
      await expect(processesPage.deleteModal).toContainText(
        BUILDING_BLOCK_PROCESS_TEXTS.deleteModalContent
      );

      const response = await processesPage.confirmDelete(
        buildingBlockKey,
        versionTag,
        generated!.id
      );
      expect(response.status()).toBe(204);

      await processesPage.rowByKey(buildingBlockKey).assertNotVisible();
      const processes = await processesPage.getProcessesViaApi(buildingBlockKey, versionTag);
      expect(processes.map(process => process.key)).toEqual([UPLOADED_PROCESS.key]);
    });

    test('13.32 — Creates a new process from the empty diagram', async () => {
      await processesPage.goToProcessesTab(buildingBlockKey, versionTag);
      await processesPage.goToCreateProcess(buildingBlockKey, versionTag);

      // Nothing to deploy until the diagram changes.
      await expect(processesPage.saveButton).toBeDisabled();

      await processesPage.enableDraft();
      await processesPage.modeler.appendTaskTo(CREATED_PROCESS.startEventId);
      await expect(processesPage.saveButton).toBeEnabled();

      const response = await processesPage.saveProcess(buildingBlockKey, versionTag);
      expect(response.status()).toBe(204);

      // Deploying returns to the Processes tab, where the new definition shows up
      // as a draft under the fixed `Process_1` key of the seeded diagram.
      await page.waitForURL(new RegExp(`/version/${versionTag}/process-definition$`));
      await processesPage.carbonList.waitForLoaded();
      await processesPage.rowByKey(CREATED_PROCESS.key).assertVisible();
      await processesPage.assertProcessTag(
        CREATED_PROCESS.key,
        BUILDING_BLOCK_PROCESS_TEXTS.draftTag
      );

      const created = await processesPage.getProcessByKeyViaApi(
        buildingBlockKey,
        versionTag,
        CREATED_PROCESS.key
      );
      expect(created).toMatchObject({key: CREATED_PROCESS.key, main: false, draft: true});
    });
  });

  test.describe('13.33–13.38 — Process diagram and step configuration', () => {
    test('13.33 — Opens a process in the BPMN modeler from its row', async () => {
      await processesPage.goToProcessesTab(buildingBlockKey, versionTag);

      const main = await processesPage.getMainProcessViaApi(buildingBlockKey, versionTag);
      await processesPage.rowByKey(UPLOADED_PROCESS.key).click();

      await page.waitForURL(new RegExp(`/process-definition/${escapeForRegExp(main.id)}$`));
      await processesPage.modeler.waitForLoaded();
      await expect(processesPage.modeler.elementShape(UPLOADED_PROCESS.startEventId)).toBeVisible();
    });

    test('13.34, 13.35 — Selects a step and shows its properties', async () => {
      const main = await processesPage.getMainProcessViaApi(buildingBlockKey, versionTag);
      await processesPage.goToProcessBuilder(buildingBlockKey, versionTag, main.id);

      // 13.34 — selecting the shape switches the panel to that element.
      await processesPage.modeler.selectElement(UPLOADED_PROCESS.startEventId);
      await expect(processesPage.modeler.panelHeaderType).toHaveAttribute(
        'title',
        BUILDING_BLOCK_PROCESS_TEXTS.startEventPanelType
      );

      // 13.35 — the panel groups, including Valtimo's own "Process link" group.
      expect(await processesPage.modeler.groupTitles()).toEqual(
        expect.arrayContaining([...BUILDING_BLOCK_PROCESS_TEXTS.startEventPanelGroups])
      );

      await processesPage.modeler.expandGroup('General');
      await expect(processesPage.modeler.idInput).toHaveValue(UPLOADED_PROCESS.startEventId);
      await expect(processesPage.modeler.nameInput).toBeVisible();
    });

    test('13.36, 13.38 — Configures a step and saves the process', async () => {
      const main = await processesPage.getMainProcessViaApi(buildingBlockKey, versionTag);
      await processesPage.goToProcessBuilder(buildingBlockKey, versionTag, main.id);

      const stepName = `Renamed start ${uniqueId}`;
      await processesPage.modeler.selectElement(UPLOADED_PROCESS.startEventId);
      // 13.36 — a step setting is changed through the properties panel.
      await processesPage.modeler.renameSelectedElement(stepName);

      // Saved as a draft: a non-draft save validates first and, because the
      // seeded diagram has an unlinked start event, waits on a "Process has
      // warnings" confirmation instead of deploying.
      await processesPage.enableDraft();

      // 13.38 — saving deploys a new version of the definition.
      const response = await processesPage.saveProcess(buildingBlockKey, versionTag);
      expect(response.status()).toBe(204);

      // The change survives a reload of the newly deployed version.
      const saved = await processesPage.getMainProcessViaApi(buildingBlockKey, versionTag);
      expect(saved.id).not.toBe(main.id);
      await processesPage.goToProcessBuilder(buildingBlockKey, versionTag, saved.id);
      await expect(processesPage.modeler.elementShape(UPLOADED_PROCESS.startEventId)).toBeVisible();
      await processesPage.modeler.selectElement(UPLOADED_PROCESS.startEventId);
      await expect(processesPage.modeler.panelHeaderLabel).toHaveAttribute('title', stepName);
    });

    test('13.37 — Opens the link wizard for a step and offers the available link types', async () => {
      const main = await processesPage.getMainProcessViaApi(buildingBlockKey, versionTag);
      await processesPage.goToProcessBuilder(buildingBlockKey, versionTag, main.id);

      await processesPage.modeler.selectElement(UPLOADED_PROCESS.startEventId);
      await processesPage.openProcessLinkModalFromPanel();

      await expect(processesPage.processLinkModal).toContainText(
        BUILDING_BLOCK_PROCESS_TEXTS.processLinkChooseTypeStep
      );
      for (const linkType of BUILDING_BLOCK_PROCESS_TEXTS.processLinkTypes) {
        await expect(processesPage.processLinkModal).toContainText(linkType);
      }

      // Cancelling links nothing.
      await processesPage.closeProcessLinkModal();
      await expect(processesPage.createProcessLinkButton).toBeVisible();
    });

    test.describe('Failure scenarios', () => {
      test('Upload and create are unavailable on a finalized version', async () => {
        await processesPage.goToProcessesTab(finalBuildingBlockKey, versionTag);

        // A finalized version is read-only, so no process can be added to it.
        await expect(processesPage.uploadButton).toBeDisabled();
        await expect(processesPage.createButton).toBeDisabled();
      });
    });
  });
});
