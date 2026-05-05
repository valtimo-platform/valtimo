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

export const EXTERNAL_PLUGIN_MANAGEMENT_TEST_IDS = {
  hostsSection: 'externalPluginHostsSection',
  definitionsSection: 'externalPluginDefinitionsSection',
  configurationsSection: 'externalPluginConfigurationsSection',
  addHostButton: 'externalPluginAddHostButton',
  addConfigurationButton: 'externalPluginAddConfigurationButton',
} as const;

export const EXTERNAL_PLUGIN_HOST_MODAL_TEST_IDS = {
  nameInput: 'externalPluginHostNameInput',
  baseUrlInput: 'externalPluginHostBaseUrlInput',
  saveButton: 'externalPluginHostSaveButton',
  cancelButton: 'externalPluginHostCancelButton',
} as const;

export const EXTERNAL_PLUGIN_CONFIGURATION_MODAL_TEST_IDS = {
  definitionSelect: 'externalPluginConfigDefinitionSelect',
  titleInput: 'externalPluginConfigTitleInput',
  propertiesInput: 'externalPluginConfigPropertiesInput',
  saveButton: 'externalPluginConfigSaveButton',
  cancelButton: 'externalPluginConfigCancelButton',
} as const;

export const EXTERNAL_PLUGIN_PROCESS_LINK_TEST_IDS = {
  configurationSelect: 'externalPluginProcessLinkConfigurationSelect',
  actionKeyInput: 'externalPluginProcessLinkActionKeyInput',
  actionPropertiesInput: 'externalPluginProcessLinkActionPropertiesInput',
} as const;
