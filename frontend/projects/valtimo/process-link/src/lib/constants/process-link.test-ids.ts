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

/** The process link wizard shell: header and footer navigation. */
export const PROCESS_LINK_MODAL_TEST_IDS = {
  heading: 'processLinkModalHeading',
  pluginConfigurationLabel: 'processLinkModalPluginConfigurationLabel',
  progressIndicator: 'processLinkModalProgressIndicator',
  cancelButton: 'processLinkModalCancelButton',
  unlinkButton: 'processLinkModalUnlinkButton',
  backButton: 'processLinkModalBackButton',
  nextButton: 'processLinkModalNextButton',
  completeButton: 'processLinkModalCompleteButton',
} as const;

export const PROCESS_LINK_TYPE_CHOOSER_TEST_IDS = {
  container: 'processLinkTypeChooser',
} as const;

/**
 * Prefix for the buttons of the "Choose link type" step. The full test id is
 * `processLinkTypeButton-<processLinkType>`, e.g. `processLinkTypeButton-plugin`.
 */
export const PROCESS_LINK_TYPE_BUTTON_TEST_ID_PREFIX = 'processLinkTypeButton-';

export const SELECT_PLUGIN_CONFIGURATION_TEST_IDS = {
  container: 'selectPluginConfiguration',
  list: 'selectPluginConfigurationList',
} as const;

/**
 * Prefix for the rows of the plugin selection step. The full test id is
 * `selectPluginConfigurationRow-<id>`, where the id is the plugin *definition*
 * key in a building block (e.g. `zakenapi`) and the plugin *configuration* id in
 * a case — the step lists definitions in the one and configurations in the other.
 */
export const SELECT_PLUGIN_CONFIGURATION_ROW_TEST_ID_PREFIX = 'selectPluginConfigurationRow-';

export const SELECT_PLUGIN_ACTION_TEST_IDS = {
  container: 'selectPluginAction',
  tileGroup: 'selectPluginActionTileGroup',
  noActionsMessage: 'selectPluginActionNoActions',
} as const;

/**
 * Prefix for the action tiles. The full test id is
 * `selectPluginActionTile-<pluginFunctionKey>`.
 */
export const SELECT_PLUGIN_ACTION_TILE_TEST_ID_PREFIX = 'selectPluginActionTile-';

export const PLUGIN_ACTION_CONFIGURATION_TEST_IDS = {
  container: 'pluginActionConfiguration',
} as const;

export const BB_MAPPINGS_TEST_IDS = {
  inputSection: 'bbMappingsInputSection',
  outputSection: 'bbMappingsOutputSection',
  addInputButton: 'bbMappingsAddInputButton',
  addOutputButton: 'bbMappingsAddOutputButton',
  inputRow: 'bbMappingsInputRow',
  outputRow: 'bbMappingsOutputRow',
  inputDeleteButton: 'bbMappingsInputDeleteButton',
  outputDeleteButton: 'bbMappingsOutputDeleteButton',
  inputRequiredIndicator: 'bbMappingsInputRequiredIndicator',
  inputRequiredTargetLabel: 'bbMappingsInputRequiredTargetLabel',
  inputTargetSelectWrapper: 'bbMappingsInputTargetSelectWrapper',
  outputSourceSelectWrapper: 'bbMappingsOutputSourceSelectWrapper',
} as const;
