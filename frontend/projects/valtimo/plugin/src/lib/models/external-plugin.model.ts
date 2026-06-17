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
  gzacCallbackBaseUrl: string | null;
  eventBrokerAmqpUrl: string | null;
  eventBrokerExchange: string | null;
}

interface ExternalPluginHostCreateRequest {
  name: string;
  baseUrl: string;
  secret: string;
  gzacCallbackBaseUrl: string;
  eventBrokerAmqpUrl: string | null;
  eventBrokerExchange: string | null;
}

interface ExternalPluginHostDefaults {
  gzacCallbackBaseUrl: string;
  eventBrokerAmqpUrl: string;
  eventBrokerExchange: string;
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

interface ExternalPluginEndpoint {
  method: string;
  pattern: string;
}

interface ExternalPluginPermissions {
  endpoints?: Array<ExternalPluginEndpoint>;
}

interface ExternalPluginManifest {
  actions?: Array<ExternalPluginAction>;
  frontendBundles?: Array<ExternalPluginFrontendBundle>;
  permissions?: ExternalPluginPermissions;
  eventSubscriptions?: Array<string>;
  logo?: string;
  translations?: Record<string, Record<string, string>>;
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
  /**
   * Declared GZAC compatibility bounds (from the manifest) and the resolved outcome of comparing
   * them against the running GZAC version. `compatible` is `false` only when the running version
   * falls outside the declared range; it stays `true` when the plugin fits, declares no bounds, or
   * the running version could not be determined. The management UI surfaces a non-blocking warning
   * when `compatible` is `false`. `currentGzacVersion` is the version the check used (null if
   * undeterminable).
   */
  minGzacVersion: string | null;
  maxGzacVersion: string | null;
  currentGzacVersion: string | null;
  compatible: boolean;
  logoUrl: string | null;
}

/** The subset of compatibility fields needed to render a warning message. */
interface ExternalPluginCompatibilityInfo {
  minGzacVersion: string | null;
  maxGzacVersion: string | null;
  currentGzacVersion: string | null;
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

interface ExternalPluginGrantedEventEntry {
  eventType: string;
}

interface ExternalPluginGrantedEventResponse {
  id: string;
  configurationId: string;
  eventType: string;
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
  grantedEvents: Array<ExternalPluginGrantedEventResponse>;
  createdAt: string;
}

interface ExternalPluginConfigurationCreateRequest {
  definitionId: string;
  title: string;
  properties: Record<string, unknown>;
  grantedEndpoints: Array<ExternalPluginGrantedEndpointEntry>;
  grantedEvents: Array<ExternalPluginGrantedEventEntry>;
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

/**
 * Resolves a per-locale manifest string (e.g. `name`, `description`) for the given language,
 * falling back to the `en` bucket. A plugin's name and description live in `manifest.translations`
 * (there are no top-level fields), so these helpers are the single source of truth for rendering a
 * localised name/description anywhere in the management and process-link UIs.
 */
function resolveManifestTranslation(
  manifest: ExternalPluginManifest | null | undefined,
  key: string,
  lang: string
): string | null {
  const translations = manifest?.translations;
  if (!translations) return null;
  const localized = translations[lang]?.[key] ?? translations['en']?.[key];
  return localized && localized.length > 0 ? localized : null;
}

function getExternalPluginName(definition: ExternalPluginDefinition, lang: string): string {
  return (
    resolveManifestTranslation(definition.manifest, 'name', lang) ??
    definition.name ??
    definition.pluginId
  );
}

function getExternalPluginDescription(
  definition: ExternalPluginDefinition,
  lang: string
): string | null {
  return (
    resolveManifestTranslation(definition.manifest, 'description', lang) ?? definition.description
  );
}

/**
 * Localised plugin name suffixed with the definition version in brackets, e.g. `Case Summary
 * (0.1.0)`. Used everywhere a plugin name is rendered so multiple coexisting versions of the same
 * plugin stay distinguishable.
 */
function getExternalPluginDisplayName(definition: ExternalPluginDefinition, lang: string): string {
  return `${getExternalPluginName(definition, lang)} (${definition.version})`;
}

/**
 * Whether the running GZAC version falls outside the plugin's declared compatibility range. Returns
 * `false` for a compatible plugin, a plugin without bounds, or when the version could not be judged
 * (the backend reports `compatible: true` in all of those cases).
 */
function isExternalPluginDefinitionIncompatible(
  definition: ExternalPluginDefinition | null | undefined
): boolean {
  return definition?.compatible === false;
}

export {
  EXTERNAL_PLUGIN_KEY_PREFIX,
  ExternalPluginAction,
  ExternalPluginFrontendBundle,
  ExternalPluginFrontendBundleType,
  ExternalPluginEndpoint,
  ExternalPluginPermissions,
  ExternalPluginManifest,
  ExternalPluginCompatibilityInfo,
  ExternalPluginHostStatus,
  ExternalPluginDefinitionStatus,
  ExternalPluginHost,
  ExternalPluginHostCreateRequest,
  ExternalPluginHostDefaults,
  ExternalPluginDefinition,
  ExternalPluginConfiguration,
  ExternalPluginConfigurationDetail,
  ExternalPluginConfigurationCreateRequest,
  ExternalPluginConfigurationUpdateRequest,
  ExternalPluginGrantedEndpointEntry,
  ExternalPluginGrantedEndpointResponse,
  ExternalPluginGrantedEventEntry,
  ExternalPluginGrantedEventResponse,
  ExternalPluginEndpointDescriptionQuery,
  ExternalPluginEndpointDescription,
  isExternalPluginKey,
  toExternalPluginKey,
  extractExternalDefinitionId,
  getExternalPluginName,
  getExternalPluginDescription,
  getExternalPluginDisplayName,
  isExternalPluginDefinitionIncompatible,
};
