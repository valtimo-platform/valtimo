/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
  | 'selectForm'
  | 'selectFormFlow'
  | 'selectBuildingBlock'
  | 'configureBuildingBlockPlugins'
  | 'configureBuildingBlockMappings'
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

type TaskProcessLinkType = 'form' | 'form-flow' | 'form-view-model' | 'url' | 'ui-component';

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
  | BuildingBlockProcessLinkUpdateDto;

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
  | UIComponentProcessLinkCreateRequestDto;

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
};

interface PluginConfigurationViewModel {
  key: string;
  label: string;
  dropdownItems: Array<ListItem>;
  hasOptions: boolean;
}

export {
  CompatiblePluginProcessLinks,
  CompatibleProcessVersion,
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
};
