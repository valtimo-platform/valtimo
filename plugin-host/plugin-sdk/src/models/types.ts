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

export interface ActionInput {
  actionKey: string;
  configurationId: string;
  configuration: Record<string, unknown>;
  processInstanceId: string;
  documentId: string;
  activityId: string;
  properties: Record<string, unknown>;
}

/**
 * `variables` is applied as process variables, unchanged from before. `result` is a separate,
 * optional channel: an arbitrary JSON payload that GZAC's `action_result_mappings` (JSON-pointer →
 * `doc:`/`pv:`/`case:` target) resolve against, entirely independent of `variables`. Plugins that
 * don't set `result` are unaffected — there is nothing to map. Actions that declare
 * {@link ManifestAction.outputs} must return a `result` containing every declared key (`null`
 * values are allowed; absent keys fail the invocation).
 */
export interface ActionOutput {
  status: "completed" | "error";
  variables?: Record<string, unknown>;
  result?: unknown;
  errorCode?: string;
  errorMessage?: string;
}

export type ActionHandler = (input: ActionInput) => ActionOutput | Promise<ActionOutput>;

/**
 * A platform event delivered to a plugin. Mirrors the CloudEvent the core app publishes to
 * RabbitMQ: the envelope fields (`type`, `id`, `source`, `time`) plus the flattened `data`
 * payload (`userId`, `roles`, `resultType`, `resultId`, `result`). `configuration` carries the
 * plugin configuration's properties, exactly like {@link ActionInput.configuration}.
 */
export interface EventInput {
  type: string;
  id: string;
  source: string;
  time?: string;
  userId?: string;
  roles?: string[];
  resultType?: string;
  resultId?: string;
  result?: unknown;
  configuration: Record<string, unknown>;
}

export interface EventOutput {
  status: "completed" | "ignored" | "error";
  errorCode?: string;
  errorMessage?: string;
}

export type EventHandler = (event: EventInput) => EventOutput | void | Promise<EventOutput | void>;

/**
 * Input to a plugin's `handle_request` data handler. A plugin serves JSON to its own iframe through
 * the host's `POST /plugins/:id/:version/data` route — the RPC-style counterpart to `handle_action`.
 * `configuration` carries the plugin configuration's properties (like {@link ActionInput.configuration});
 * `context` is the opaque per-call context the iframe passed through (e.g. the documentId/case keys).
 */
export interface RequestInput {
  method: string;
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  configurationId?: string;
  configuration: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export interface RequestOutput {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
}

export type RequestHandler = (input: RequestInput) => RequestOutput | Promise<RequestOutput>;

/**
 * Input to a plugin's `handle_submit` task-form hook (Level 1). GZAC invokes this synchronously
 * during a task-form submission, before completing the task. `submission` is the raw data the form
 * collected (typically value-resolver-prefixed keys); `configuration` carries the plugin
 * configuration's properties (like {@link ActionInput.configuration}). The `taskId`/`documentId`/
 * `processInstanceId` are the authoritative, backend-supplied context — never trust a task id from
 * the submission body.
 */
export interface SubmitInput {
  submitKey: string;
  configurationId: string;
  configuration: Record<string, unknown>;
  taskId?: string;
  processInstanceId?: string;
  documentId?: string;
  submission: Record<string, unknown>;
}

/**
 * Result of a `handle_submit` hook. Mirrors {@link ActionOutput} but for task-form submission:
 * - `completed` → GZAC completes the task using `variables` (process variables) and, optionally,
 *   `documentContent` (a map of JSON-pointer path → value applied to the case document).
 * - `error` → GZAC does **not** complete the task; `errorMessage` and `fieldErrors` (field → message)
 *   are surfaced back to the form.
 */
export interface SubmitOutput {
  status: "completed" | "error";
  variables?: Record<string, unknown>;
  documentContent?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
  fieldErrors?: Record<string, string>;
}

export type SubmitHandler = (input: SubmitInput) => SubmitOutput | Promise<SubmitOutput>;

export interface ManifestAction {
  key: string;
  title: string;
  description?: string;
  activityTypes: string[];
  properties?: ManifestActionProperty[];
  /**
   * Keys the action's {@link ActionOutput.result} object exposes for result-mapping. When present
   * (and non-empty), GZAC's process-link stepper offers a dedicated output-mapping step letting an
   * admin map these keys to `doc:`/`pv:`/`case:` targets, with the source restricted to this
   * declared set (a dropdown instead of free-text JSON pointers). Actions without `outputs` (or an
   * empty array) have no declared shape and cannot use result mapping.
   *
   * Declaring `outputs` is a runtime contract: a completed action's `result` must contain every
   * declared key — the host (and GZAC) reject a result with missing keys — but a key's value may
   * be `null`. The runtime serialises `undefined` values on the result object as `null`, so
   * `result: {title}` keeps the `title` key even when the lookup found nothing.
   */
  outputs?: string[];
}

export interface ManifestActionProperty {
  key: string;
  type: string;
  required?: boolean;
}

export interface Endpoint {
  method: string;
  pattern: string;
}

export const HOST_CAPABILITIES = ["gzac_api", "http_request", "kv", "log"] as const;
export type HostCapability = (typeof HOST_CAPABILITIES)[number];

/**
 * Frontend bundle `type` values the platform knows how to render. Single source of truth for both
 * the compile-time {@link FrontendBundleType} and the runtime allow-list used by
 * `validatePluginManifest` (which imports this dependency-free list rather than duplicating it).
 */
export const FRONTEND_BUNDLE_TYPES = [
  "config",
  "process-link-action",
  "case-tab",
  "case-widget",
  "page",
  "task-form",
] as const;

export type FrontendBundleType = (typeof FRONTEND_BUNDLE_TYPES)[number];

export interface FrontendBundle {
  type: FrontendBundleType;
  key?: string;
  title?: string;
  path: string;
  activityTypes?: string[];
  menuIcon?: string;
  menuPosition?: string;
  renderMode?: "bundle" | "htmx";
  /**
   * For `task-form` bundles only: when true, GZAC invokes the plugin's `submit(key, …)` hook during
   * submission (Level 1) before completing the task. The hook key equals this bundle's `key`.
   */
  submitHandler?: boolean;
}

/**
 * A single locale's translation bucket.
 *
 * `name` and `description` are **mandatory**: they supply the plugin's localised display name and
 * description. The manifest has **no** top-level `name`/`description` — the plugin's identity is
 * defined per locale here so it can be rendered in the operator's language. Any additional keys are
 * free-form translation strings consumed by the frontend SDK's `t(key)` lookup inside the plugin's
 * iframes.
 */
export interface PluginTranslations {
  name: string;
  description: string;
  [key: string]: string;
}

export interface PluginManifest {
  pluginId: string;
  version: string;
  provider?: string;
  compatibility?: {
    minGzacVersion?: string;
    maxGzacVersion?: string;
  };
  configurationSchema?: Record<string, unknown>;
  permissions?: {
    endpoints?: Endpoint[];
    capabilities?: HostCapability[];
  };
  frontendBundles?: FrontendBundle[];
  /**
   * Filename of the plugin logo relative to the plugin root (e.g. `logo.svg`). Written by the
   * pack tool when it finds a `logo.{svg,png,jpg,jpeg}` next to `manifest.json`. The host serves
   * the file at `GET /plugins/:id/:version/logo` so the GZAC management UI can display it.
   */
  logo?: string;
  /**
   * Translations keyed by locale (e.g.
   * `{ "en": { "name": "Case Summary", "description": "…", "config.title": "Configuration name" } }`).
   * Every locale bucket must carry a `name` and a `description` — these replace the former
   * top-level `name`/`description` fields. The frontend SDK picks the active locale, falling back
   * to `en`, and exposes a `t(key)` lookup to React/HTMX templates in the plugin's iframes.
   */
  translations: Record<string, PluginTranslations>;
  actions: ManifestAction[];
  /**
   * CloudEvent `type` values this plugin subscribes to. The host routes matching events from
   * RabbitMQ to the plugin's `handle_event` export.
   */
  eventSubscriptions?: string[];
}

/**
 * Generic shape of a `gzac_api` callback response. Mirrors the host's response envelope.
 */
export interface GzacApiResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  body: T;
}

/**
 * Response from the `http_request` host function. Same shape as {@link GzacApiResponse}.
 */
export interface HttpRequestResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  body: T;
}

export interface KvGetResult<T = unknown> {
  found: boolean;
  value: T | undefined;
}

/**
 * Minimal Valtimo document shape — only the fields plugins typically read.
 *
 * Returned by GZAC's `GET /api/v1/document/{id}`. The full response from GZAC carries additional
 * fields; declare extra properties on your own type if you need them.
 */
export interface DocumentContent {
  [key: string]: unknown;
}

export interface DocumentDefinitionId {
  name: string;
  /**
   * The owning blueprint (case definition / building block). Since the case-definition refactor the
   * version lives here as `blueprintVersionTag`, not as a top-level `version` on the definitionId.
   */
  blueprintId?: {
    blueprintKey: string;
    blueprintType: "CASE" | "BUILDING_BLOCK";
    blueprintVersionTag: string;
  };
}

export interface Document {
  id: string;
  /**
   * Serialized as `definitionId` on GZAC's `GET /api/v1/document/{id}` response — see
   * {@link https://...} `com.ritense.document.domain.Document.definitionId()`.
   */
  definitionId: DocumentDefinitionId;
  content: DocumentContent;
  createdBy?: string;
  createdOn?: string;
  modifiedOn?: string;
  assigneeId?: string | null;
  assigneeFullName?: string | null;
}
