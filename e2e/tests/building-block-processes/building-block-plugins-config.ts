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

/**
 * The building block used by the plugin integration tests. Separate from the
 * one in `building-block-processes-config.ts` so the two suites cannot disturb
 * each other's process definitions.
 */
export const PLUGIN_TEST_BUILDING_BLOCK = {
  keyPrefix: 'e2e-bb-plugins',
  namePrefix: 'E2E BB Plugins',
  description: 'Building block created by the e2e building block plugin integration test.',
  versionTag: '1.0.0',
} as const;

/**
 * The BPMN uploaded for these tests. Only some element types can carry a process
 * link, and which link types they offer differs per type — hence one process with
 * one of each.
 *
 * Every step carries an implementation, because the building block process upload
 * rejects a diagram that `ProcessDefinitionValidator` raises *warnings* for, and
 * a step without a process link or implementation is exactly such a warning.
 */
export const PLUGIN_STEPS_PROCESS = {
  fileName: 'e2e-plugin-steps-process.bpmn',
  key: 'e2e-plugin-steps-process',
  name: 'E2E Plugin Steps Process',
  /** Offers only the Plugin link type, so the wizard skips the chooser step. */
  serviceTaskId: 'ServiceTask_1',
  serviceTaskName: 'Service step',
  /** Offers Form / FormFlow / Plugin, plus UI Component (disabled here). */
  userTaskId: 'UserTask_1',
  /** The only type that additionally offers the Building block link type. */
  callActivityId: 'CallActivity_1',
} as const;

/**
 * The plugin the tests link to, and two of its actions.
 *
 * A building block links a step to a plugin **definition**, not to a plugin
 * *configuration* — the configuration is bound later, when a case links to the
 * building block. So the selection step lists definitions and the saved link
 * carries `pluginConfigurationId: null`.
 */
export const LINKED_PLUGIN = {
  definitionKey: 'zakenapi',
  title: 'Zaken API',
  /** Requires no action properties, so Complete is enabled immediately. */
  actionWithoutRequiredProperties: {
    key: 'link-uploaded-document-to-zaak',
    label: 'Link uploaded document to zaak',
  },
  /** Has two required properties, so Complete stays disabled until they are filled. */
  actionWithRequiredProperties: {
    key: 'create-zaak',
    label: 'Create zaak',
    description:
      'This action creates a zaak in the Zaken API and links the new zaak with the case.',
    requiredPropertyLabels: ['RSIN (required)', 'Zaaktype URL (required)'],
  },
} as const;

/** A second plugin definition, used to assert the list is not a single row. */
export const OTHER_PLUGIN = {
  definitionKey: 'documentenapi',
  title: 'Documenten API',
} as const;

export const BUILDING_BLOCK_PLUGIN_TEXTS = {
  /** Steps of the plugin branch of the wizard, in order. */
  wizardSteps: ['Select plugin definition', 'Choose your action', 'Configure your action'],
  modalHeading: (stepName: string) => `Process step: ${stepName}`,
  /** Link types offered by a user task inside a building block. */
  userTaskLinkTypes: ['form', 'form-flow', 'plugin'],
  /** Disabled inside a building block — see UNSUPPORTED_PROCESS_LINK_TYPES_IN_BUILDING_BLOCK. */
  unsupportedLinkType: 'ui-component',
  /** A call activity is the only step type that may point at another building block. */
  callActivityLinkTypes: ['plugin', 'building-block'],
} as const;

export const BUILDING_BLOCK_PLUGIN_API = {
  /** Plugin definitions that can be linked to a given activity type. */
  pluginDefinitions: (activityType: string) =>
    `/api/v1/plugin/definition?activityType=${encodeURIComponent(activityType)}`,
  processLinks: (processDefinitionId: string) =>
    `/api/v1/process-link?processDefinitionId=${encodeURIComponent(processDefinitionId)}`,
  serviceTaskActivityType: 'bpmn:ServiceTask:start',
} as const;
