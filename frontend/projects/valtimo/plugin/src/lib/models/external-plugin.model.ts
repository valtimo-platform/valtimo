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
  /**
   * Browser origins (`scheme://host[:port]`) allowed to embed this host's plugin screens. The
   * backend pushes them to the plugin host, which serves them as the `frame-ancestors` CSP
   * directive. Empty means no page may frame this host's plugins.
   */
  frontendOrigins: Array<string>;
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
  frontendOrigins: Array<string>;
}

interface ExternalPluginHostDefaults {
  gzacCallbackBaseUrl: string;
  eventBrokerAmqpUrl: string;
  eventBrokerExchange: string;
  defaultEventQueueTtlMs: number;
  minEventQueueTtlMs: number;
  maxEventQueueTtlMs: number;
  /**
   * Origins derived from the configured CORS allowed-origins. Empty when CORS is unconfigured, in
   * which case the add-host form falls back to the admin's own `window.location.origin` — the page
   * the plugin will actually be embedded in.
   */
  frontendOrigins: Array<string>;
}

interface ExternalPluginHostEventQueueUpdateRequest {
  eventQueueMode: ExternalPluginEventQueueMode;
  eventQueueTtlMs: number | null;
}

/**
 * Connection-field update (#618). Every field is optional and absent means unchanged, so the edit
 * modal sends only what the admin actually edited. That convention is what lets the write-only
 * secret (never present in any response) and the credential-redacted broker URL round-trip safely.
 * A blank secret means unchanged; blank broker fields mean clear.
 */
interface ExternalPluginHostConnectionUpdateRequest {
  name?: string;
  baseUrl?: string;
  secret?: string;
  gzacCallbackBaseUrl?: string;
  eventBrokerAmqpUrl?: string;
  eventBrokerExchange?: string;
}

/** The plugin host's 201 body for a successful package upload, relayed by the backend. */
interface ExternalPluginUploadResult {
  pluginId: string;
  version: string;
  contentHash?: string;
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
  /** The action's inputs; flat string/number/integer/boolean ones get a generated form. */
  properties?: Array<ExternalPluginActionProperty>;
  /**
   * Keys the action's `result` object exposes for mapping. When present and non-empty, the
   * process-link stepper offers a dedicated output-mapping step with a dropdown of these keys as
   * mapping sources. Actions without `outputs` (or an empty array) have no declared shape and
   * cannot use result mapping.
   */
  outputs?: Array<string>;
}

interface ExternalPluginActionProperty {
  key: string;
  type: string;
  required?: boolean;
}

type ExternalPluginFrontendBundleType =
  | 'config'
  | 'process-link-action'
  | 'case-tab'
  | 'case-widget'
  | 'page'
  | 'task-form'
  | 'side-panel';

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
  /**
   * Origins the plugin's `http_request` calls may reach, declared by the author for the targets that
   * are the same in every environment. `http_request` is deny-by-default, so anything not listed here
   * — and not supplied by the admin in a property marked `x-egress-target` — is refused by the host.
   */
  egress?: Array<string>;
  /**
   * Contracts (`name@major`) the plugin calls. A string entry may call every operation the bound
   * provider offers; an object entry only the listed `operations`. A declared contract may stay
   * unbound — calls to it then fail.
   */
  contracts?: Array<string | ExternalPluginManifestDeclaredContract>;
}

/** Object form of a `permissions.contracts` entry. */
interface ExternalPluginManifestDeclaredContract {
  contract: string;
  operations: Array<string>;
}

/** A `permissions.contracts` entry in either form; `operations` is null when any operation may be called. */
interface ExternalPluginDeclaredContract {
  contract: string;
  operations: Array<string> | null;
}

/** `job` operations run asynchronously and complete later, up to their `timeout`. */
type ExternalPluginContractOperationMode = 'sync' | 'job';

interface ExternalPluginContractOperation {
  key: string;
  title: string;
  description?: string;
  /** Absent means `sync`. */
  mode?: ExternalPluginContractOperationMode;
  /** ISO-8601 duration (e.g. `PT2H`), only with mode `job`. */
  timeout?: string;
  outputs?: Array<string>;
}

interface ExternalPluginProvidedContract {
  contract: string;
  title?: string;
  operations: Array<ExternalPluginContractOperation>;
}

interface ExternalPluginManifest {
  actions?: Array<ExternalPluginAction>;
  /** Contracts this plugin answers for other plugins. */
  provides?: Array<ExternalPluginProvidedContract>;
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
  /**
   * Which of the two re-acceptance prompts applies: `true` when the pending package asks for a
   * different permission footprint, `false` when only its code changed.
   */
  pendingPermissionsChanged: boolean;
  pendingManifest: ExternalPluginManifest | null;
  /**
   * True while only a deployment descriptor has heard of this plugin: no manifest, so nothing to
   * validate a configuration against and the backend refuses one. Cleared by discovery.
   */
  awaitingDiscovery: boolean;
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

interface ExternalPluginGrantedEgressResponse {
  id: string;
  configurationId: string;
  target: string;
  grantedAt: string;
}

interface ExternalPluginConfigurationDetail {
  id: string;
  definitionId: string;
  title: string;
  properties: Record<string, unknown>;
  grantedEndpoints: Array<ExternalPluginGrantedEndpointResponse>;
  grantedEvents: Array<ExternalPluginGrantedEventResponse>;
  grantedEgress: Array<ExternalPluginGrantedEgressResponse>;
  /** Origins derived from this configuration's own `x-egress-target` values; recomputed per read. */
  derivedEgress: Array<string>;
  contractBindings: Array<ExternalPluginContractBindingResponse>;
  createdAt: string;
}

interface ExternalPluginConfigurationCreateRequest {
  definitionId: string;
  title: string;
  properties: Record<string, unknown>;
  grantedEndpoints: Array<ExternalPluginGrantedEndpointEntry>;
  grantedEvents: Array<ExternalPluginGrantedEventEntry>;
  grantedCapabilities: Array<string>;
  /**
   * The manifest's `permissions.egress` entries, accepted whole. Environment-specific targets are not
   * sent — GZAC derives those from the `x-egress-target` property values in `properties`.
   */
  grantedEgress: Array<string>;
  /** At most one binding per declared contract; a declared contract left out stays unbound. */
  contractBindings?: Array<ExternalPluginContractBindingEntry>;
}

interface ExternalPluginConfigurationUpdateRequest {
  title: string;
  properties: Record<string, unknown>;
  grantedEndpoints?: Array<ExternalPluginGrantedEndpointEntry>;
  /** Absent means unchanged; present replaces every binding, so a contract left out becomes unbound. */
  contractBindings?: Array<ExternalPluginContractBindingEntry>;
}

interface ExternalPluginContractBindingEntry {
  contract: string;
  targetConfigurationId: string;
}

interface ExternalPluginContractBindingResponse extends ExternalPluginContractBindingEntry {
  targetConfigurationTitle: string | null;
}

interface ExternalPluginContractProviderOperation {
  key: string;
  title: string | null;
  mode: ExternalPluginContractOperationMode | null;
  timeout: string | null;
}

/** A configuration whose definition's accepted manifest `provides` the requested contract. */
interface ExternalPluginContractProvider {
  configurationId: string;
  configurationTitle: string;
  definitionId: string;
  pluginId: string;
  version: string;
  hostId: string;
  hostName: string | null;
  hostKind: ExternalPluginHostKind | null;
  available: boolean;
  /** The provider manifest's `provides[].title` for the contract. */
  contractTitle: string | null;
  /** Language → key → text, limited to the provider manifest's `contracts.<contract>.` keys. */
  contractTranslations: Record<string, Record<string, string>>;
  operations: Array<ExternalPluginContractProviderOperation>;
}

const EXTERNAL_PLUGIN_CONTRACT_JOB_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'COMPLETED',
  'FAILED',
  'EXPIRED',
  'DELIVERED',
  'UNDELIVERABLE',
] as const;

type ExternalPluginContractJobStatus = (typeof EXTERNAL_PLUGIN_CONTRACT_JOB_STATUSES)[number];

/** How a job finished; kept while its reply is delivered (`DELIVERED`) or given up on (`UNDELIVERABLE`). */
type ExternalPluginContractJobOutcome = Extract<
  ExternalPluginContractJobStatus,
  'COMPLETED' | 'FAILED' | 'EXPIRED'
>;

interface ExternalPluginContractJobSummary {
  id: string;
  contract: string;
  operation: string;
  requesterConfigurationId: string;
  requesterTitle: string | null;
  requesterPluginId: string | null;
  providerConfigurationId: string;
  providerTitle: string | null;
  providerPluginId: string | null;
  status: ExternalPluginContractJobStatus;
  requestedBy: string | null;
  createdAt: string;
  updatedAt: string | null;
  completedAt: string | null;
  deliveredAt: string | null;
  deadline: string | null;
  deliveryAttempts: number;
  errorCode: string | null;
  /** The provider's own code for a failure it reported (`errorCode` is then `PROVIDER_ERROR`). */
  providerErrorCode: string | null;
  errorMessage: string | null;
}

/** Payloads are left out: `getContractJobPayload` reads them, and GZAC records every such read. */
interface ExternalPluginContractJobDetail extends ExternalPluginContractJobSummary {
  documentId: string | null;
  outcome: ExternalPluginContractJobOutcome | null;
  idempotencyKey: string | null;
  replyToProcessInstanceId: string | null;
  lastDeliveryError: string | null;
}

interface ExternalPluginContractJobPayload {
  requestPayload: unknown | null;
  resultPayload: unknown | null;
}

interface ExternalPluginContractJobQuery {
  page: number;
  size: number;
  status?: ExternalPluginContractJobStatus;
  configurationId?: string;
}

const EXTERNAL_PLUGIN_HOST_USAGE_PARENT_TYPES = [
  'CASE',
  'BUILDING_BLOCK',
  'GLOBAL',
  'CONTRACT_BINDING',
  'CONTRACT_JOB',
] as const;

/**
 * What an `ExternalPluginHostUsage` hangs off. For process-link usages it owns the process
 * definition; `GLOBAL` doubles as the fallback when that definition can't be resolved at all — in
 * that case `parentKey` and `parentVersionTag` are both null. `CONTRACT_BINDING` and `CONTRACT_JOB`
 * name the contract in `parentKey`.
 */
type ExternalPluginHostUsageParentType = (typeof EXTERNAL_PLUGIN_HOST_USAGE_PARENT_TYPES)[number];

/**
 * One reference to a configuration — a BPMN activity, case tab or widget, building-block mapping,
 * menu page, contract binding or open contract job. A configuration (and its host) cannot be
 * deleted while any of these exist; the management UI uses this payload to disable the delete
 * action and tell the admin what holds it in use.
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
  // Populated only for contract usages: the contract, the open job, and the other configuration
  // (the one binding this configuration, or the job's other party).
  contract?: string | null;
  contractJobId?: string | null;
  relatedConfigurationId?: string | null;
  relatedConfigurationTitle?: string | null;
  // Populated only for a menu-page usage: an external-plugin `page` bundle placed in the
  // application menu references the configuration. Names the menu item.
  menuItemTitle?: string | null;
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
  return resolveTranslation(manifest?.translations, key, lang);
}

function resolveTranslation(
  translations: Record<string, Record<string, string>> | null | undefined,
  key: string,
  lang: string
): string | null {
  if (!translations) return null;
  const localized = translations[lang]?.[key] ?? translations['en']?.[key];
  return localized && localized.length > 0 ? localized : null;
}

/**
 * The manifest's `provides` with titles and descriptions localised from its translations, keyed
 * `contracts.<contract>.title` and `contracts.<contract>.operations.<key>.{title,description}`.
 * The manifest's own strings are the fallback.
 */
function getExternalPluginProvidedContracts(
  manifest: ExternalPluginManifest | null | undefined,
  lang: string
): Array<ExternalPluginProvidedContract> {
  return (manifest?.provides ?? []).map(provided => ({
    ...provided,
    title:
      resolveManifestTranslation(manifest, `contracts.${provided.contract}.title`, lang) ??
      provided.title,
    operations: (provided.operations ?? []).map(operation =>
      localizeContractOperation(manifest, provided.contract, operation, lang)
    ),
  }));
}

function localizeContractOperation(
  manifest: ExternalPluginManifest | null | undefined,
  contract: string,
  operation: ExternalPluginContractOperation,
  lang: string
): ExternalPluginContractOperation {
  const prefix = `contracts.${contract}.operations.${operation.key}`;
  return {
    ...operation,
    title: resolveManifestTranslation(manifest, `${prefix}.title`, lang) ?? operation.title,
    description:
      resolveManifestTranslation(manifest, `${prefix}.description`, lang) ?? operation.description,
  };
}

/**
 * The manifest's `permissions.contracts` in a single shape: a string entry may call any operation
 * (`operations: null`). Malformed entries and repeats of a contract are skipped.
 */
function getExternalPluginDeclaredContracts(
  manifest: ExternalPluginManifest | null | undefined
): Array<ExternalPluginDeclaredContract> {
  const declared = new Map<string, ExternalPluginDeclaredContract>();
  for (const entry of manifest?.permissions?.contracts ?? []) {
    const parsed = parseDeclaredContract(entry);
    if (parsed && !declared.has(parsed.contract)) declared.set(parsed.contract, parsed);
  }
  return [...declared.values()];
}

function parseDeclaredContract(entry: unknown): ExternalPluginDeclaredContract | null {
  if (typeof entry === 'string') return entry ? {contract: entry, operations: null} : null;
  if (!entry || typeof entry !== 'object') return null;

  const {contract, operations} = entry as Partial<ExternalPluginManifestDeclaredContract>;
  if (typeof contract !== 'string' || !contract) return null;

  return {
    contract,
    operations: Array.isArray(operations)
      ? [...new Set(operations.filter(operation => typeof operation === 'string'))]
      : null,
  };
}

/** The contract's title as the provider names it, localised from its `contracts.<contract>.title`. */
function getExternalPluginContractTitle(
  provider: ExternalPluginContractProvider,
  contract: string,
  lang: string
): string | null {
  return (
    resolveTranslation(provider.contractTranslations, `contracts.${contract}.title`, lang) ??
    provider.contractTitle ??
    null
  );
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
  ExternalPluginActionProperty,
  ExternalPluginFrontendBundle,
  ExternalPluginFrontendBundleType,
  ExternalPluginEndpoint,
  ExternalPluginPermissions,
  ExternalPluginManifestDeclaredContract,
  ExternalPluginDeclaredContract,
  ExternalPluginContractOperationMode,
  ExternalPluginContractOperation,
  ExternalPluginProvidedContract,
  ExternalPluginManifest,
  ExternalPluginCompatibilityInfo,
  ExternalPluginHostStatus,
  ExternalPluginDefinitionStatus,
  ExternalPluginEventQueueMode,
  ExternalPluginHostKind,
  ExternalPluginHost,
  ExternalPluginHostCreateRequest,
  ExternalPluginHostDefaults,
  ExternalPluginHostConnectionUpdateRequest,
  ExternalPluginHostEventQueueUpdateRequest,
  ExternalPluginHostUsage,
  ExternalPluginHostUsageParentType,
  EXTERNAL_PLUGIN_HOST_USAGE_PARENT_TYPES,
  ExternalPluginUploadResult,
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
  ExternalPluginGrantedEgressResponse,
  ExternalPluginEndpointDescriptionQuery,
  ExternalPluginEndpointDescription,
  ExternalPluginContractBindingEntry,
  ExternalPluginContractBindingResponse,
  ExternalPluginContractProviderOperation,
  ExternalPluginContractProvider,
  ExternalPluginContractJobStatus,
  EXTERNAL_PLUGIN_CONTRACT_JOB_STATUSES,
  ExternalPluginContractJobOutcome,
  ExternalPluginContractJobSummary,
  ExternalPluginContractJobDetail,
  ExternalPluginContractJobPayload,
  ExternalPluginContractJobQuery,
  isExternalPluginKey,
  toExternalPluginKey,
  extractExternalDefinitionId,
  getExternalPluginName,
  getExternalPluginDescription,
  getExternalPluginProvidedContracts,
  getExternalPluginDeclaredContracts,
  getExternalPluginContractTitle,
  getExternalPluginDisplayName,
  isExternalPluginDefinitionIncompatible,
  PluginLogEntry,
  PluginLogPage,
};
