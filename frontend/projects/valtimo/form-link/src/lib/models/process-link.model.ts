/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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

interface SaveProcessLinkRequest {
  processDefinitionId: string;
  activityId: string;
  activityType: string;
  pluginConfigurationId: string;
  pluginActionDefinitionKey: string;
  actionProperties: {
    [key: string]: any;
  };
}

interface ProcessLink extends SaveProcessLinkRequest {
  id: string;
}

type GetProcessLinkResponse = Array<ProcessLink>;

interface GetProcessLinkRequest {
  activityId: string;
  processDefinitionId: string;
}

interface UpdateProcessLinkRequest {
  id: string;
  pluginConfigurationId: string;
  pluginActionDefinitionKey: string;
  actionProperties: {
    [key: string]: any;
  };
}

type ProcessLinkModalType = 'edit' | 'create';

export {
  SaveProcessLinkRequest,
  GetProcessLinkRequest,
  ProcessLink,
  GetProcessLinkResponse,
  UpdateProcessLinkRequest,
  ProcessLinkModalType,
};
