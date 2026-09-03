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
import {
  BUILDING_BLOCK_PLUGIN_API,
  BUILDING_BLOCK_PLUGIN_TEXTS,
  LINKED_PLUGIN,
  OTHER_PLUGIN,
  PLUGIN_STEPS_PROCESS,
  PLUGIN_TEST_BUILDING_BLOCK,
} from './building-block-plugins-config';
import {BuildingBlockProcessesPage} from './page';

test.use({storageState: undefined});

/**
 * Feature 13E — linking a building block's process steps to plugins.
 *
 * Inside a building block a step is linked to a plugin **definition**, not to a
 * plugin *configuration*: the configuration is bound later, when a case links to
 * the building block. So the selection step lists definitions, and a saved link
 * carries `pluginConfigurationId: null` with `referenceType: BUILDING_BLOCK`.
 *
 * All tests share one building block whose only extra process is the seeded
 * plugin-steps diagram. That diagram is re-read before every test: a link made
 * in the modeler lives in memory until the diagram is saved, and saving deploys
 * a *new* definition, so the process definition id changes underneath the suite.
 */
test.describe('Building block management — plugin integration (13E)', () => {
  let context;
  let page;
  let request;
  let pluginsPage: BuildingBlockProcessesPage;

  const uniqueId = generateId();
  const buildingBlockKey = `${PLUGIN_TEST_BUILDING_BLOCK.keyPrefix}-${uniqueId}`;
  const versionTag = PLUGIN_TEST_BUILDING_BLOCK.versionTag;

  /** Latest definition of the seeded plugin-steps process. */
  const currentProcess = async () => {
    const process = await pluginsPage.getProcessByKeyViaApi(
      buildingBlockKey,
      versionTag,
      PLUGIN_STEPS_PROCESS.key
    );
    expect(process, 'the plugin steps process is deployed').toBeTruthy();
    return process!;
  };

  const openWizardFor = async (elementId: string) => {
    const process = await currentProcess();
    await pluginsPage.openLinkWizardForStep(buildingBlockKey, versionTag, process.id, elementId);
    return process;
  };

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    pluginsPage = new BuildingBlockProcessesPage(page, request);

    await pluginsPage.createBuildingBlockViaApi({
      key: buildingBlockKey,
      name: `${PLUGIN_TEST_BUILDING_BLOCK.namePrefix} ${uniqueId}`,
      versionTag,
      description: PLUGIN_TEST_BUILDING_BLOCK.description,
    });

    await page.goto('/');

    // The diagram carries one of every step type that can hold a process link.
    await pluginsPage.goToProcessesTab(buildingBlockKey, versionTag);
    const upload = await pluginsPage.uploadProcess(
      buildingBlockKey,
      versionTag,
      PLUGIN_STEPS_PROCESS.fileName
    );
    expect(upload.status(), 'the plugin steps process uploaded').toBe(204);
  });

  test.afterAll(async () => {
    // Removes the uploaded process and every version a save deployed. The
    // generated main definition stays — it cannot be deleted — and so does the
    // building block itself: the management API exposes no DELETE for it.
    await pluginsPage.deleteAddedProcessesViaApi(buildingBlockKey, versionTag, buildingBlockKey);
    await pluginsPage.deleteBuildingBlockViaApi(buildingBlockKey, versionTag);

    await context.close();
  });

  test.describe('13.39, 13.42 — Available plugins', () => {
    test('13.39 — A service task lists the plugin definitions it can be linked to', async () => {
      await openWizardFor(PLUGIN_STEPS_PROCESS.serviceTaskId);

      // A service task can only carry a plugin link, so the wizard skips the
      // link type chooser and opens straight on the plugin selection step.
      await expect(pluginsPage.linkWizard.typeChooser).toBeHidden();
      await expect(pluginsPage.linkWizard.pluginStep).toBeVisible();
      await expect(pluginsPage.linkWizard.heading).toHaveText(
        BUILDING_BLOCK_PLUGIN_TEXTS.modalHeading(PLUGIN_STEPS_PROCESS.serviceTaskName)
      );

      // The step names definitions, not configurations.
      await expect(pluginsPage.linkWizard.pluginStep).toHaveText(
        BUILDING_BLOCK_PLUGIN_TEXTS.selectPluginDescription
      );

      const offered = await pluginsPage.linkWizard.offeredPluginIds();
      expect(offered).toEqual(expect.arrayContaining([LINKED_PLUGIN.definitionKey]));
      // More than one plugin is offered, so the list is a real choice.
      expect(offered).toEqual(expect.arrayContaining([OTHER_PLUGIN.definitionKey]));

      // Every offered definition is one the backend serves for this activity
      // type. The UI additionally drops definitions without a frontend plugin
      // specification, so it is a subset rather than an exact match.
      const definitions = await pluginsPage.getPluginDefinitionsViaApi(
        BUILDING_BLOCK_PLUGIN_API.serviceTaskActivityType
      );
      const definitionKeys = definitions.map(definition => definition.key);
      expect(definitionKeys).toEqual(expect.arrayContaining(offered));

      await pluginsPage.closeProcessLinkModal();
    });

    test('13.42 — The list shows each plugin with its description, and the wizard its steps', async () => {
      await openWizardFor(PLUGIN_STEPS_PROCESS.serviceTaskId);

      expect(
        await pluginsPage.linkWizard.pluginList.locator('cds-list-header cds-list-column')
          .allInnerTexts()
      ).toEqual([...BUILDING_BLOCK_PLUGIN_TEXTS.selectPluginColumns]);

      // Logo, name and a non-empty description, in that column order.
      const row = pluginsPage.linkWizard.pluginRow(LINKED_PLUGIN.definitionKey);
      const columns = row.locator('cds-list-column');
      await expect(columns.nth(0).locator('img')).toBeVisible();
      await expect(columns.nth(1)).toHaveText(LINKED_PLUGIN.title);
      await expect(columns.nth(2)).not.toBeEmpty();

      expect(await pluginsPage.linkWizard.stepTitles()).toEqual(
        expect.arrayContaining([...BUILDING_BLOCK_PLUGIN_TEXTS.wizardSteps])
      );

      await pluginsPage.closeProcessLinkModal();
    });
  });

  test.describe('13.40 — Select a plugin for a step', () => {
    test('13.40 — Picking a plugin enables Next and reveals its actions', async () => {
      await openWizardFor(PLUGIN_STEPS_PROCESS.serviceTaskId);

      // Nothing is preselected, so the wizard cannot be advanced yet.
      await expect(pluginsPage.linkWizard.nextButton).toBeDisabled();

      await pluginsPage.linkWizard.selectPlugin(LINKED_PLUGIN.definitionKey);
      await expect(pluginsPage.linkWizard.nextButton).toBeEnabled();

      await pluginsPage.linkWizard.next();
      await expect(pluginsPage.linkWizard.actionStep).toBeVisible();

      // The chosen plugin is echoed by the progress indicator.
      expect(await pluginsPage.linkWizard.stepTitles()).toEqual(
        expect.arrayContaining([LINKED_PLUGIN.title])
      );

      const actionKeys = await pluginsPage.linkWizard.offeredActionKeys();
      expect(actionKeys).toEqual(
        expect.arrayContaining([
          LINKED_PLUGIN.actionWithoutRequiredProperties.key,
          LINKED_PLUGIN.actionWithRequiredProperties.key,
        ])
      );
      await expect(pluginsPage.linkWizard.noActionsMessage).toHaveCount(0);

      await pluginsPage.closeProcessLinkModal();
    });

    test('13.40 — A call activity offers the plugin link type alongside the building block one', async () => {
      await openWizardFor(PLUGIN_STEPS_PROCESS.callActivityId);

      // A call activity can hold more than one link type, so the chooser is shown.
      await expect(pluginsPage.linkWizard.typeChooser).toBeVisible();
      expect(await pluginsPage.linkWizard.offeredLinkTypes()).toEqual([
        ...BUILDING_BLOCK_PLUGIN_TEXTS.callActivityLinkTypes,
      ]);

      await pluginsPage.linkWizard.chooseLinkType('plugin');
      await expect(pluginsPage.linkWizard.pluginStep).toBeVisible();

      await pluginsPage.closeProcessLinkModal();
    });
  });

  test.describe('13.41, 13.44 — Configure the action', () => {
    test('13.41 — An action without properties is configurable straight away', async () => {
      await openWizardFor(PLUGIN_STEPS_PROCESS.serviceTaskId);

      await pluginsPage.linkWizard.advanceToActionConfiguration(
        LINKED_PLUGIN.definitionKey,
        LINKED_PLUGIN.actionWithoutRequiredProperties.key
      );

      await expect(pluginsPage.linkWizard.actionConfigurationStep).toBeVisible();
      // 13.42 — the step explains that this action needs no configuration.
      await expect(pluginsPage.linkWizard.host).toContainText(
        LINKED_PLUGIN.actionWithoutRequiredProperties.configurationMessage
      );
      await expect(pluginsPage.linkWizard.completeButton).toBeEnabled();

      await pluginsPage.closeProcessLinkModal();
    });

    test('13.41, 13.44 — An action with properties describes them and accepts values', async () => {
      await openWizardFor(PLUGIN_STEPS_PROCESS.serviceTaskId);

      await pluginsPage.linkWizard.advanceToActionConfiguration(
        LINKED_PLUGIN.definitionKey,
        LINKED_PLUGIN.actionWithRequiredProperties.key
      );

      // 13.42 — the action explains what it does and which properties it needs.
      await expect(pluginsPage.linkWizard.host).toContainText(
        LINKED_PLUGIN.actionWithRequiredProperties.description
      );
      for (const label of LINKED_PLUGIN.actionWithRequiredProperties.requiredPropertyLabels) {
        await expect(pluginsPage.linkWizard.host.getByText(label)).toBeVisible();
      }

      // 13.44 — the execution properties are filled in.
      await pluginsPage.fillCreateZaakProperties(LINKED_PLUGIN.actionWithRequiredProperties.values);
      await expect(pluginsPage.createZaakRsinInput).toHaveValue(
        LINKED_PLUGIN.actionWithRequiredProperties.values.rsin
      );
      await expect(pluginsPage.linkWizard.completeButton).toBeEnabled();

      await pluginsPage.closeProcessLinkModal();
    });

    test.describe('Failure scenarios', () => {
      test('13.45a — Complete stays disabled while a required property is empty', async () => {
        await openWizardFor(PLUGIN_STEPS_PROCESS.serviceTaskId);

        await pluginsPage.linkWizard.advanceToActionConfiguration(
          LINKED_PLUGIN.definitionKey,
          LINKED_PLUGIN.actionWithRequiredProperties.key
        );

        // Both properties are required, so an empty form cannot be completed.
        await expect(pluginsPage.linkWizard.completeButton).toBeDisabled();

        // Filling only one of the two is not enough either.
        await pluginsPage.createZaakRsinInput.fill(
          LINKED_PLUGIN.actionWithRequiredProperties.values.rsin
        );
        await expect(pluginsPage.linkWizard.completeButton).toBeDisabled();

        await pluginsPage.createZaakZaaktypeUrlInput.fill(
          LINKED_PLUGIN.actionWithRequiredProperties.values.zaaktypeUrl
        );
        await expect(pluginsPage.linkWizard.completeButton).toBeEnabled();

        // Clearing one again disables it, so the guard is not a one-way latch.
        await pluginsPage.createZaakRsinInput.fill('');
        await expect(pluginsPage.linkWizard.completeButton).toBeDisabled();

        // Cancelling stores nothing.
        await pluginsPage.closeProcessLinkModal();
        await expect(pluginsPage.createProcessLinkButton).toBeVisible();
      });

      test('13.45b — A user task cannot be linked to a UI component inside a building block', async () => {
        await openWizardFor(PLUGIN_STEPS_PROCESS.userTaskId);

        await expect(pluginsPage.linkWizard.typeChooser).toBeVisible();
        expect(await pluginsPage.linkWizard.offeredLinkTypes()).toEqual([
          ...BUILDING_BLOCK_PLUGIN_TEXTS.userTaskLinkTypes,
        ]);

        // The UI component type is offered but rendered disabled: it is not
        // supported inside a building block.
        await expect(
          pluginsPage.linkWizard.typeButton(BUILDING_BLOCK_PLUGIN_TEXTS.unsupportedLinkType)
        ).toBeDisabled();
        for (const linkType of BUILDING_BLOCK_PLUGIN_TEXTS.userTaskEnabledLinkTypes) {
          await expect(pluginsPage.linkWizard.typeButton(linkType)).toBeEnabled();
        }

        await pluginsPage.closeProcessLinkModal();
      });
    });
  });

  test.describe('13.43 — Link an action to a plugin definition', () => {
    test('13.43, 13.44 — Completing the wizard links the step, and saving persists the link', async () => {
      const process = await openWizardFor(PLUGIN_STEPS_PROCESS.serviceTaskId);

      await pluginsPage.linkWizard.advanceToActionConfiguration(
        LINKED_PLUGIN.definitionKey,
        LINKED_PLUGIN.actionWithRequiredProperties.key
      );
      await pluginsPage.fillCreateZaakProperties(LINKED_PLUGIN.actionWithRequiredProperties.values);
      await pluginsPage.linkWizard.complete();

      // The panel swaps Create for Edit/Unlink once the step carries a link.
      await expect(pluginsPage.editProcessLinkButton).toBeVisible();
      await expect(pluginsPage.unlinkProcessLinkButton).toBeVisible();
      await expect(pluginsPage.createProcessLinkButton).toHaveCount(0);

      // The link only lives in the modeler until the diagram is saved.
      expect(await pluginsPage.getProcessLinksViaApi(process.id)).toEqual([]);

      // Saved as a draft: a non-draft save is validated first and would wait on
      // a confirmation instead of deploying.
      await pluginsPage.enableDraft();
      const response = await pluginsPage.saveProcess(buildingBlockKey, versionTag);
      expect(response.status()).toBe(204);

      // Saving deploys a new version of the definition, which carries the link.
      const saved = await currentProcess();
      expect(saved.id).not.toBe(process.id);

      const links = await pluginsPage.getProcessLinksViaApi(saved.id);
      expect(links).toHaveLength(1);
      expect(links[0]).toMatchObject({
        activityId: PLUGIN_STEPS_PROCESS.serviceTaskId,
        activityType: BUILDING_BLOCK_PLUGIN_API.serviceTaskActivityType,
        processLinkType: 'plugin',
        pluginDefinitionKey: LINKED_PLUGIN.definitionKey,
        pluginActionDefinitionKey: LINKED_PLUGIN.actionWithRequiredProperties.key,
        // A building block links to a plugin *definition*: the configuration is
        // only bound when a case links to the building block.
        pluginConfigurationId: null,
        referenceType: 'BUILDING_BLOCK',
      });
      // 13.44 — the execution properties are stored with the link.
      expect(links[0].actionProperties).toMatchObject({
        rsin: LINKED_PLUGIN.actionWithRequiredProperties.values.rsin,
        zaaktypeUrl: LINKED_PLUGIN.actionWithRequiredProperties.values.zaaktypeUrl,
      });
    });

    test('13.43, 13.44 — Reopening the link shows the stored action and its properties', async () => {
      // Reopens the link the previous test saved.
      const saved = await currentProcess();
      await pluginsPage.goToProcessBuilder(buildingBlockKey, versionTag, saved.id);
      await pluginsPage.modeler.selectElement(PLUGIN_STEPS_PROCESS.serviceTaskId);
      await pluginsPage.modeler.expandGroup('Process link');
      await pluginsPage.editProcessLinkButton.click();
      await pluginsPage.linkWizard.waitForOpen();

      // Editing opens on the last step, with the earlier choices marked complete.
      await expect(pluginsPage.linkWizard.actionConfigurationStep).toBeVisible();
      expect(await pluginsPage.linkWizard.stepTitles()).toEqual(
        expect.arrayContaining([...BUILDING_BLOCK_PLUGIN_TEXTS.wizardSteps])
      );

      // No plugin configuration is bound: the link points at a definition.
      await expect(pluginsPage.linkWizard.pluginConfigurationLabel).toHaveText(
        BUILDING_BLOCK_PLUGIN_TEXTS.noPluginConfigurationLabel
      );

      // 13.44 — the stored execution properties are prefilled.
      await expect(pluginsPage.createZaakRsinInput).toHaveValue(
        LINKED_PLUGIN.actionWithRequiredProperties.values.rsin
      );
      await expect(pluginsPage.createZaakZaaktypeUrlInput).toHaveValue(
        LINKED_PLUGIN.actionWithRequiredProperties.values.zaaktypeUrl
      );

      // An existing link can be removed again from here.
      await expect(pluginsPage.linkWizard.unlinkButton).toBeVisible();

      await pluginsPage.closeProcessLinkModal();
    });
  });
});
