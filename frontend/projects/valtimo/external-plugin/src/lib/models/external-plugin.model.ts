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

type ExternalPluginHostStatus = 'CONNECTED' | 'UNREACHABLE';
type ExternalPluginDefinitionStatus = 'AVAILABLE' | 'UNAVAILABLE';

interface ExternalPluginHost {
  id: string;
  name: string;
  baseUrl: string;
  status: ExternalPluginHostStatus;
  lastHealthCheck: string | null;
}

interface ExternalPluginHostCreateRequest {
  name: string;
  baseUrl: string;
}

interface ExternalPluginDefinition {
  id: string;
  pluginId: string;
  version: string;
  name: string | null;
  description: string | null;
  provider: string | null;
  hostId: string;
  baseUrl: string;
  status: ExternalPluginDefinitionStatus;
  configurationSchema: unknown | null;
  manifest: unknown | null;
}

interface ExternalPluginConfiguration {
  id: string;
  definitionId: string;
  title: string;
  createdAt: string;
}

interface ExternalPluginConfigurationCreateRequest {
  definitionId: string;
  title: string;
  properties: Record<string, unknown>;
}

export {
  ExternalPluginHost,
  ExternalPluginHostStatus,
  ExternalPluginHostCreateRequest,
  ExternalPluginDefinition,
  ExternalPluginDefinitionStatus,
  ExternalPluginConfiguration,
  ExternalPluginConfigurationCreateRequest,
};
