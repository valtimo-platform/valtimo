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
import {PluginConfiguration} from '@valtimo/plugin';
import {ProcessInstanceTask} from '@valtimo/process';
import {ListItem} from 'carbon-components-angular/dropdown';
import {PluginRequirementSource} from './plugin.model';

interface ProcessLink {
  id: string;
  processDefinitionId: string;
  activityId: string;
  activityType: string;
  processLinkType: string;
  pluginConfigurationId?: string;
  pluginDefinitionKey?: string;
  referenceType?: PluginConfigurationReferenceType;
  pluginActionDefinitionKey?: string;
  actionProperties?: {
    [key: string]: any;
  };
  actionResultMappings?: Array<PluginActionResultMapping>;
  formDefinitionId?: string;
  formFlowDefinitionKey?: string;
  viewModelEnabled?: boolean;
  url?: string;
  formDisplayType?: FormDisplayType;
  formSize?: FormSize;
  subtitles?: string[];
  componentKey?: string;
  buildingBlockDefinitionKey?: string;
  buildingBlockDefinitionVersionTag?: string;
  pluginConfigurationMappings?: Record<string, string>;
  inputMappings?: Array<BuildingBlockInputMapping>;
  outputMappings?: Array<BuildingBlockOutputMapping>;
  externalPluginConfigurationId?: string;
  actionKey?: string;
  pluginVersion?: string;
  bundleKey?: string;
}

type GetProcessLinkResponse = Array<ProcessLink>;

interface GetProcessLinkRequest {
  activityId?: string;
  processDefinitionId: string;
}

interface ProcessLinkType {
  enabled: boolean;
  processLinkType: string;
}

type ProcessLinkConfigurationStep =
  | 'chooseProcessLinkType'
  | 'choosePluginConfiguration'
  | 'choosePluginAction'
  | 'configurePluginAction'
  | 'configurePluginActionResultMappings'
  | 'selectForm'
  | 'selectFormFlow'
  | 'selectBuildingBlock'
  | 'configureBuildingBlockPlugins'
  | 'configureBuildingBlockMappings'
  | 'configureExternalPlugin'
  | 'empty';

type PluginConfigurationReferenceType = 'FIXED' | 'BUILDING_BLOCK';

interface FormProcessLinkCreateRequestDto {
  processDefinitionId: string;
  activityId: string;
  activityType: string;
  processLinkType: string;
  formDefinitionId: string;
  viewModelEnabled: boolean;
  formDisplayType?: string;
  formSize?: string;
  subtitles?: string[];
}

interface FormFlowProcessLinkCreateRequestDto {
  processDefinitionId: string;
  activityId: string;
  activityType: string;
  processLinkType: string;
  formFlowDefinitionKey: string;
  formDisplayType?: string;
  formSize?: string;
  subtitles: string[];
}

interface PluginProcessLinkCreateDto {
  processDefinitionId: string;
  activityId: string;
  activityType: string;
  processLinkType: string;
  pluginConfigurationId?: string;
  pluginActionDefinitionKey: string;
  actionProperties: object;
  referenceType?: PluginConfigurationReferenceType;
  pluginDefinitionKey?: string;
  actionResultMappings?: Array<PluginActionResultMapping>;
}

interface PluginProcessLinkUpdateDto {
  id: string;
  activityId: string;
  pluginConfigurationId?: string;
  pluginActionDefinitionKey: string;
  actionProperties: {
    [key: string]: any;
  };
  referenceType: PluginConfigurationReferenceType;
  pluginDefinitionKey?: string;
  actionResultMappings?: Array<PluginActionResultMapping>;
}

interface FormFlowProcessLinkUpdateRequestDto {
  id: string;
  activityId: string;
  formFlowDefinitionId: string;
  formDisplayType?: string;
  formSize?: string;
}

interface FormProcessLinkUpdateRequestDto {
  id: string;
  activityId: string;
  formDefinitionId: string;
  viewModelEnabled: boolean;
  formDisplayType?: string;
  formSize?: string;
  subtitles?: string[];
}

type FormDisplayType = 'modal' | 'panel';

type FormSize = 'extraSmall' | 'small' | 'medium' | 'large';

interface UIComponentProcessLinkCreateRequestDto {
  componentKey: string;
  activityId: string;
  activityType: string;
  processLinkType: string;
  processDefinitionId: string;
}

interface UIComponentProcessLinkUpdateRequestDto {
  id: string;
  componentKey: string;
  activityId: string;
}

interface URLProcessLinkCreateDto {
  url: string;
  activityId: string;
  activityType: string;
  processLinkType: string;
}

interface URLProcessLinkUpdateRequestDto {
  url: string;
  id: string;
  activityId: string;
}

interface UIComponentProcessLinkCreateRequestDto {
  componentKey: string;
  activityId: string;
  activityType: string;
  processLinkType: string;
  processDefinitionId: string;
}

interface UIComponentProcessLinkUpdateRequestDto {
  id: string;
  componentKey: string;
}

interface BuildingBlockProcessLinkCreateDto {
  processDefinitionId: string;
  activityId: string;
  activityType: string;
  processLinkType: string;
  buildingBlockDefinitionKey: string;
  buildingBlockDefinitionVersionTag: string;
  pluginConfigurationMappings: Record<string, string>;
  inputMappings: Array<BuildingBlockInputMapping>;
  outputMappings: Array<BuildingBlockOutputMapping>;
}

interface BuildingBlockProcessLinkUpdateDto {
  id: string;
  activityId: string;
  processLinkType: string;
  buildingBlockDefinitionKey: string;
  buildingBlockDefinitionVersionTag: string;
  pluginConfigurationMappings: Record<string, string>;
  inputMappings: Array<BuildingBlockInputMapping>;
  outputMappings: Array<BuildingBlockOutputMapping>;
}

/**
 * `externalPluginConfigurationId` is required for `FIXED` references and omitted for
 * `BUILDING_BLOCK` references, mirroring the embedded plugin process link (D1). For
 * `BUILDING_BLOCK`, `pluginDefinitionKey` (the external plugin's `pluginId`) and `pluginVersion`
 * are required instead — field names must match
 * `ExternalPluginProcessLinkCreateRequestDto`/`UpdateRequestDto` on the backend exactly.
 */
interface ExternalPluginProcessLinkCreateDto {
  processDefinitionId: string;
  activityId: string;
  activityType: string;
  processLinkType: 'external_plugin';
  externalPluginConfigurationId?: string;
  actionKey: string;
  pluginVersion: string;
  referenceType?: PluginConfigurationReferenceType;
  pluginDefinitionKey?: string;
  actionProperties?: object;
  actionResultMappings?: Array<PluginActionResultMapping>;
}

interface ExternalPluginProcessLinkUpdateDto {
  id: string;
  processLinkType: 'external_plugin';
  externalPluginConfigurationId?: string;
  actionKey: string;
  pluginVersion: string;
  referenceType?: PluginConfigurationReferenceType;
  pluginDefinitionKey?: string;
  actionProperties?: object;
  actionResultMappings?: Array<PluginActionResultMapping>;
}

interface ExternalPluginTaskFormProcessLinkCreateDto {
  processDefinitionId: string;
  activityId: string;
  activityType: string;
  processLinkType: 'external_plugin_task_form';
  externalPluginConfigurationId: string;
  pluginVersion: string;
  // Always serialized (null when the plugin's task-form bundle has no key) so the backend's
  // field-based (Jackson DEDUCTION) process-link type resolution can distinguish this from the
  // action link, which is identified by its `actionKey`.
  bundleKey: string | null;
}

interface ExternalPluginTaskFormProcessLinkUpdateDto {
  id: string;
  processLinkType: 'external_plugin_task_form';
  externalPluginConfigurationId: string;
  pluginVersion: string;
  bundleKey: string | null;
}

type BuildingBlockSyncTiming = 'CONTINUOUS' | 'END';

interface BuildingBlockInputMapping {
  source: string;
  target: string;
}

interface BuildingBlockOutputMapping {
  source: string;
  target: string;
  syncTiming: BuildingBlockSyncTiming;
}

/**
 * A single plugin-action result write-back rule (`com.ritense.plugin.domain.PluginActionResultMapping`
 * on the backend). `source` is an RFC 6901 JSON pointer into the action's result (empty string =
 * whole result); `target` is a value-resolver-prefixed key (`doc:`, `pv:`, `case:`) describing where
 * to write it.
 */
interface PluginActionResultMapping {
  source: string;
  target: string;
}

type TaskProcessLinkType =
  | 'form'
  | 'form-flow'
  | 'form-view-model'
  | 'url'
  | 'ui-component'
  | 'external-plugin-task-form';

interface ExternalPluginTaskFormContext {
  taskId?: string | null;
  processInstanceId?: string | null;
  documentId?: string | null;
  pluginConfigurationId?: string;
}

interface TaskProcessLinkResult {
  processLinkId: string;
  type: TaskProcessLinkType;
  assignee: string | null;
  due: string | null;
  properties: {
    formFlowInstanceId?: string;
    formDefinitionId?: string;
    prefilledForm?: any;
    formDefinition?: any;
    formName?: string;
    url?: string;
    formDisplayType?: FormDisplayType;
    formSize?: FormSize;
    componentKey?: string;
    // external-plugin-task-form
    bundleUrl?: string | null;
    configurationId?: string;
    bundleKey?: string | null;
    context?: ExternalPluginTaskFormContext;
  };
}

interface TaskWithProcessLink {
  task: ProcessInstanceTask;
  processLinkActivityResult: TaskProcessLinkResult;
}

type ProcessLinkUpdateEvent =
  | PluginProcessLinkUpdateDto
  | FormFlowProcessLinkUpdateRequestDto
  | FormProcessLinkUpdateRequestDto
  | URLProcessLinkUpdateRequestDto
  | UIComponentProcessLinkUpdateRequestDto
  | BuildingBlockProcessLinkUpdateDto
  | ExternalPluginProcessLinkUpdateDto
  | ExternalPluginTaskFormProcessLinkUpdateDto;

interface ProcessLinkDeleteEvent {
  activityId: string;
}

interface CompatibleProcessVersion {
  version: string;
  processLinks: ProcessLink[];
}

interface CompatiblePluginProcessLinks {
  processDefinitionKey: string;
  versions: CompatibleProcessVersion[];
}

type ProcessLinkCreateEvent =
  | FormProcessLinkCreateRequestDto
  | FormFlowProcessLinkCreateRequestDto
  | PluginProcessLinkCreateDto
  | BuildingBlockProcessLinkCreateDto
  | URLProcessLinkCreateDto
  | UIComponentProcessLinkCreateRequestDto
  | ExternalPluginProcessLinkCreateDto
  | ExternalPluginTaskFormProcessLinkCreateDto;

interface ProcessLinkDeleteEvent {
  activityId: string;
}

interface CompatibleProcessVersion {
  version: string;
  processLinks: ProcessLink[];
}

interface CompatiblePluginProcessLinks {
  processDefinitionKey: string;
  versions: CompatibleProcessVersion[];
}

interface CompatibleProcessVersion {
  version: string;
  processLinks: ProcessLink[];
}

interface CompatiblePluginProcessLinks {
  processDefinitionKey: string;
  versions: CompatibleProcessVersion[];
}

type PluginListItem = {
  id: string;
  title: string;
  description: string;
  logo?: string | null;
  payload: PluginConfiguration | string;
  isDefinition: boolean;
  external?: boolean;
  externalConfigurationId?: string;
  externalDefinitionId?: string;
};

interface PluginConfigurationViewModel {
  key: string;
  label: string;
  dropdownItems: Array<ListItem>;
  hasOptions: boolean;
  source: PluginRequirementSource;
  pluginDefinitionVersion?: string | null;
  /**
   * The selected external configuration's actual definition version, set only when it differs from
   * `pluginDefinitionVersion` (D3 non-blocking warning). `undefined` for embedded plugins and exact
   * version matches.
   */
  selectedConfigurationVersion?: string;
}

interface DuplicateProcessDefinitionDescriptor {
  key: string;
  name?: string;
  processDefinitionId: string;
}

interface BuildingBlockProcessDefinitionConflictResponse {
  duplicateProcessDefinitions: DuplicateProcessDefinitionDescriptor[];
}

interface ProcessDefinitionConflictResponse {
  processDefinitionKey: string;
  processDefinitionId: string;
  processDefinitionName?: string;
}

export {
  CompatiblePluginProcessLinks,
  CompatibleProcessVersion,
  ExternalPluginProcessLinkCreateDto,
  ExternalPluginProcessLinkUpdateDto,
  ExternalPluginTaskFormContext,
  ExternalPluginTaskFormProcessLinkCreateDto,
  ExternalPluginTaskFormProcessLinkUpdateDto,
  FormDisplayType,
  FormFlowProcessLinkCreateRequestDto,
  FormFlowProcessLinkUpdateRequestDto,
  FormProcessLinkCreateRequestDto,
  FormProcessLinkUpdateRequestDto,
  FormSize,
  BuildingBlockProcessLinkCreateDto,
  BuildingBlockProcessLinkUpdateDto,
  BuildingBlockInputMapping,
  BuildingBlockOutputMapping,
  BuildingBlockSyncTiming,
  GetProcessLinkRequest,
  GetProcessLinkResponse,
  PluginActionResultMapping,
  PluginConfigurationViewModel,
  PluginProcessLinkCreateDto,
  PluginProcessLinkUpdateDto,
  ProcessLink,
  ProcessLinkConfigurationStep,
  ProcessLinkCreateEvent,
  ProcessLinkDeleteEvent,
  ProcessLinkType,
  ProcessLinkUpdateEvent,
  PluginConfigurationReferenceType,
  PluginListItem,
  TaskProcessLinkResult,
  TaskProcessLinkType,
  TaskWithProcessLink,
  UIComponentProcessLinkCreateRequestDto,
  UIComponentProcessLinkUpdateRequestDto,
  URLProcessLinkCreateDto,
  URLProcessLinkUpdateRequestDto,
  BuildingBlockProcessDefinitionConflictResponse,
  DuplicateProcessDefinitionDescriptor,
  ProcessDefinitionConflictResponse,
};
