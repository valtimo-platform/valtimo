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
type ExternalPluginEventQueueMode = 'LIVE' | 'DURABLE';

/**
 * The kind of remote integration. Both kinds speak the same contract to GZAC; the kind only drives
 * the admin UX (labelling, and hiding the upload flow for apps).
 * - `PLUGIN_HOST`: a multi-plugin host that plugins are uploaded to.
 * - `APP`: a remote service, added by URL, that serves its own single plugin and accepts no uploads.
 */
type ExternalPluginHostKind = 'PLUGIN_HOST' | 'APP';

interface ExternalPluginHost {
  id: string;
  name: string;
  baseUrl: string;
  kind: ExternalPluginHostKind;
  status: ExternalPluginHostStatus;
  lastHealthCheck: string | null;
  gzacCallbackBaseUrl: string | null;
  eventBrokerAmqpUrl: string | null;
  eventBrokerExchange: string | null;
  eventQueueMode: ExternalPluginEventQueueMode;
  eventQueueTtlMs: number | null;
}

interface ExternalPluginHostCreateRequest {
  name: string;
  baseUrl: string;
  secret: string;
  kind: ExternalPluginHostKind;
  gzacCallbackBaseUrl: string;
  eventBrokerAmqpUrl: string | null;
  eventBrokerExchange: string | null;
  eventQueueMode: ExternalPluginEventQueueMode;
  eventQueueTtlMs: number | null;
}

interface ExternalPluginHostDefaults {
  gzacCallbackBaseUrl: string;
  eventBrokerAmqpUrl: string;
  eventBrokerExchange: string;
  defaultEventQueueTtlMs: number;
  minEventQueueTtlMs: number;
  maxEventQueueTtlMs: number;
}

interface ExternalPluginHostEventQueueUpdateRequest {
  eventQueueMode: ExternalPluginEventQueueMode;
  eventQueueTtlMs: number | null;
}

interface ExternalPluginAction {
  key: string;
  title?: string;
  description?: string;
  /**
   * `ActivityTypeWithEventName` names (e.g. `["SERVICE_TASK_START"]`) the action supports. External
   * plugin actions are invoked by execution listeners, so this is the set of BPMN activities the
   * action may be linked to — a user-task form is the separate `task-form` surface, not an action.
   */
  activityTypes?: Array<string>;
  /**
   * Keys the action's `result` object exposes for mapping. When present and non-empty, the
   * process-link stepper offers a dedicated output-mapping step with a dropdown of these keys as
   * mapping sources. Actions without `outputs` (or an empty array) have no declared shape and
   * cannot use result mapping.
   */
  outputs?: Array<string>;
}

type ExternalPluginFrontendBundleType =
  | 'config'
  | 'process-link-action'
  | 'case-tab'
  | 'case-widget'
  | 'page'
  | 'task-form';

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
  capabilities?: Array<string>;
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
  /**
   * Package content hash pinned when the plugin was discovered, and — when the host started
   * serving different bytes under the same pluginId@version — the hash it serves now. While
   * `requiresReacceptance` is true the backend withholds configuration pushes, tokens and
   * invocations; an admin confirms the reviewed `pendingContentHash` via
   * `POST /definition/{id}/accept-content` to resume.
   */
  contentHash: string | null;
  pendingContentHash: string | null;
  requiresReacceptance: boolean;
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
  /** Revocation counter — bumped by `POST /configuration/{id}/revoke-tokens`. */
  tokenGeneration: number;
}

/** Response of the downscoped user-token mint endpoint (`.../configuration/{id}/user-token`). */
interface ExternalPluginUserTokenResponse {
  userToken: string;
  expiresAt: string;
  /**
   * The configuration's granted endpoints, so the iframe host can precheck proxied GZAC calls
   * client-side (audit-C1). An empty array means the configuration grants nothing (deny-all in the
   * precheck); the server-side allowlist remains authoritative either way.
   */
  grantedEndpoints: Array<ExternalPluginEndpoint>;
}

/**
 * Result of an external-plugin task-form submission
 * (`.../process-link/{id}/external-plugin-task-form/submission`). Mirrors the backend DTO: a
 * submission failed when `errors` or `fieldErrors` is non-empty.
 */
interface ExternalPluginTaskFormSubmissionResult {
  errors: string[];
  fieldErrors: Record<string, string>;
  documentId?: string;
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
  grantedCapabilities: Array<string>;
}

interface ExternalPluginConfigurationUpdateRequest {
  title: string;
  properties: Record<string, unknown>;
  grantedEndpoints?: Array<ExternalPluginGrantedEndpointEntry>;
}

/**
 * What owns the process definition that an `ExternalPluginHostUsage` lives on. `GLOBAL` also
 * doubles as the fallback when the process definition can't be resolved at all — in that case
 * `parentKey` and `parentVersionTag` are both null.
 */
type ExternalPluginHostUsageParentType = 'CASE' | 'BUILDING_BLOCK' | 'GLOBAL';

/**
 * One BPMN activity that references a configuration under a plugin host. The host cannot be
 * deleted while any of these exist; the management UI uses this payload to disable the delete
 * action and tell the admin which case / building block / global process holds the host alive.
 */
interface ExternalPluginHostUsage {
  configurationId: string;
  configurationTitle: string;
  parentType: ExternalPluginHostUsageParentType;
  parentKey: string | null;
  parentVersionTag: string | null;
  // Process-link usages populate these; external-plugin case-tab usages leave them null.
  processDefinitionId: string | null;
  processDefinitionKey: string | null;
  processDefinitionName: string | null;
  activityId: string | null;
  activityName: string | null;
  processLinkId: string | null;
  // Populated for an external-plugin case-tab usage, and for an external-plugin case-widget usage
  // (where they identify the owning WIDGETS tab).
  tabKey?: string | null;
  tabName?: string | null;
  // Populated only for an external-plugin case-widget usage; names the widget within the tab.
  widgetKey?: string | null;
  // Populated only for a building-block mapping usage (the BB's pluginConfigurationMappings
  // reference the configuration); names the building block holding the mapping.
  buildingBlockKey?: string | null;
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

interface PluginLogEntry {
  /** A BIGSERIAL the host serializes as a string; an opaque identifier, never arithmetic. */
  id: string;
  level: string;
  message: string;
  data: Record<string, unknown> | null;
  source: string;
  createdAt: string;
}

interface PluginLogPage {
  content: Array<PluginLogEntry>;
  page: number;
  size: number;
  totalElements: number;
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
  ExternalPluginEventQueueMode,
  ExternalPluginHostKind,
  ExternalPluginHost,
  ExternalPluginHostCreateRequest,
  ExternalPluginHostDefaults,
  ExternalPluginHostEventQueueUpdateRequest,
  ExternalPluginHostUsage,
  ExternalPluginHostUsageParentType,
  ExternalPluginDefinition,
  ExternalPluginConfiguration,
  ExternalPluginUserTokenResponse,
  ExternalPluginTaskFormSubmissionResult,
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
  PluginLogEntry,
  PluginLogPage,
};
