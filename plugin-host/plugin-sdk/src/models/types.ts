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

export interface ActionOutput {
  status: "completed" | "error";
  variables?: Record<string, unknown>;
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

export interface ManifestAction {
  key: string;
  title: string;
  description?: string;
  activityTypes: string[];
  properties?: ManifestActionProperty[];
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

export interface FrontendBundle {
  type: "config" | "process-link-action" | "case-tab" | "case-widget" | "page";
  key?: string;
  title?: string;
  path: string;
  activityTypes?: string[];
  menuIcon?: string;
  menuPosition?: string;
  renderMode?: "bundle" | "htmx";
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
  version: number;
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
