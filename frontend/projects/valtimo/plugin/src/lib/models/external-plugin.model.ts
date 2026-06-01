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
  secret: string;
}

interface ExternalPluginAction {
  key: string;
  title?: string;
  description?: string;
}

type ExternalPluginFrontendBundleType = 'config' | 'process-link-action' | 'case-tab' | 'case-widget' | 'page';

interface ExternalPluginFrontendBundle {
  type: ExternalPluginFrontendBundleType;
  key?: string;
  title?: string;
  path: string;
}

interface ExternalPluginManagementEndpoint {
  method: string;
  pattern: string;
}

interface ExternalPluginPermissions {
  managementEndpoints?: Array<ExternalPluginManagementEndpoint>;
}

interface ExternalPluginManifest {
  actions?: Array<ExternalPluginAction>;
  frontendBundles?: Array<ExternalPluginFrontendBundle>;
  permissions?: ExternalPluginPermissions;
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
  manifest: ExternalPluginManifest | null;
}

interface ExternalPluginConfiguration {
  id: string;
  definitionId: string;
  title: string;
  createdAt: string;
}

interface ExternalPluginGrantedEndpointEntry {
  method: string;
  pattern: string;
}

interface ExternalPluginGrantedEndpointResponse {
  id: string;
  configurationId: string;
  httpMethod: string;
  endpointPattern: string;
  grantedAt: string;
}

interface ExternalPluginEndpointDescriptionQuery {
  method: string;
  pattern: string;
}

interface ExternalPluginEndpointDescription {
  method: string;
  pattern: string;
  description: string | null;
}

interface ExternalPluginConfigurationDetail {
  id: string;
  definitionId: string;
  title: string;
  properties: Record<string, unknown>;
  grantedEndpoints: Array<ExternalPluginGrantedEndpointResponse>;
  createdAt: string;
}

interface ExternalPluginConfigurationCreateRequest {
  definitionId: string;
  title: string;
  properties: Record<string, unknown>;
  grantedEndpoints: Array<ExternalPluginGrantedEndpointEntry>;
}

interface ExternalPluginConfigurationUpdateRequest {
  title: string;
  properties: Record<string, unknown>;
  grantedEndpoints?: Array<ExternalPluginGrantedEndpointEntry>;
}

const EXTERNAL_PLUGIN_KEY_PREFIX = 'external:';

function isExternalPluginKey(key: string | undefined | null): boolean {
  return !!key?.startsWith(EXTERNAL_PLUGIN_KEY_PREFIX);
}

function toExternalPluginKey(definitionId: string): string {
  return `${EXTERNAL_PLUGIN_KEY_PREFIX}${definitionId}`;
}

function extractExternalDefinitionId(key: string): string {
  return key.replace(EXTERNAL_PLUGIN_KEY_PREFIX, '');
}

export {
  EXTERNAL_PLUGIN_KEY_PREFIX,
  ExternalPluginAction,
  ExternalPluginFrontendBundle,
  ExternalPluginFrontendBundleType,
  ExternalPluginManagementEndpoint,
  ExternalPluginPermissions,
  ExternalPluginManifest,
  ExternalPluginHostStatus,
  ExternalPluginDefinitionStatus,
  ExternalPluginHost,
  ExternalPluginHostCreateRequest,
  ExternalPluginDefinition,
  ExternalPluginConfiguration,
  ExternalPluginConfigurationDetail,
  ExternalPluginConfigurationCreateRequest,
  ExternalPluginConfigurationUpdateRequest,
  ExternalPluginGrantedEndpointEntry,
  ExternalPluginGrantedEndpointResponse,
  ExternalPluginEndpointDescriptionQuery,
  ExternalPluginEndpointDescription,
  isExternalPluginKey,
  toExternalPluginKey,
  extractExternalDefinitionId,
};
