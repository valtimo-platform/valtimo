/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

interface ProcessLink {
  id: string;
  processDefinitionId: string;
  activityId: string;
  activityType: string;
  processLinkType: string;
  pluginConfigurationId?: string;
  pluginActionDefinitionKey?: string;
  actionProperties?: {
    [key: string]: any;
  };
  formDefinitionId?: string;
  formFlowDefinitionId?: string;
  viewModelEnabled?: boolean;
  formDisplayType?: FormDisplayType;
  formSize?: FormSize;
}

type GetProcessLinkResponse = Array<ProcessLink>;

interface GetProcessLinkRequest {
  activityId: string;
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
  | 'empty';

interface FormProcessLinkCreateRequestDto {
  processDefinitionId: string;
  activityId: string;
  activityType: string;
  processLinkType: string;
  formDefinitionId: string;
  viewModelEnabled: boolean;
  formDisplayType?: string;
  formSize?: string;
}

interface FormFlowProcessLinkCreateRequestDto {
  processDefinitionId: string;
  activityId: string;
  activityType: string;
  processLinkType: string;
  formFlowDefinitionId: string;
}

interface PluginProcessLinkCreateDto {
  processDefinitionId: string;
  activityId: string;
  activityType: string;
  processLinkType: string;
  pluginConfigurationId: string;
  pluginActionDefinitionKey: string;
  actionProperties: object;
}

interface PluginProcessLinkUpdateDto {
  id: string;
  pluginConfigurationId: string;
  pluginActionDefinitionKey: string;
  actionProperties: {
    [key: string]: any;
  };
}

interface FormFlowProcessLinkUpdateRequestDto {
  id: string;
  formFlowDefinitionId: string;
  formDisplayType?: string;
  formSize?: string;
}

interface FormProcessLinkUpdateRequestDto {
  id: string;
  formDefinitionId: string;
  viewModelEnabled: boolean;
  formDisplayType?: string;
  formSize?: string;
}

type FormDisplayType = 'modal' | 'panel';
type FormSize = 'extraSmall' | 'small' | 'medium' | 'large';

export {
  GetProcessLinkRequest,
  ProcessLink,
  GetProcessLinkResponse,
  PluginProcessLinkUpdateDto,
  ProcessLinkType,
  ProcessLinkConfigurationStep,
  FormProcessLinkCreateRequestDto,
  FormFlowProcessLinkCreateRequestDto,
  PluginProcessLinkCreateDto,
  FormFlowProcessLinkUpdateRequestDto,
  FormProcessLinkUpdateRequestDto,
  FormDisplayType,
  FormSize,
};
