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

export interface PluginManifest {
  pluginId: string;
  version: string;
  name: string;
  description?: string;
  provider?: string;
  compatibility?: {
    minGzacVersion?: string;
    maxGzacVersion?: string;
  };
  configurationSchema?: Record<string, unknown>;
  actions: ManifestAction[];
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
