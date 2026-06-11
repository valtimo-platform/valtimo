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

// Public API — what plugin developers import
export { action } from "./actions.js";
export { onEvent } from "./events.js";
export { config } from "./config.js";
export { log } from "./host-functions.js";
export { gzacApi } from "./gzac-api.js";
export { setManifest } from "./runtime.js";
export { handleAction, handleEvent, handleGetManifest, handle_action, handle_event } from "./runtime.js";

// Types
export type {
  ActionInput,
  ActionOutput,
  ActionHandler,
  EventInput,
  EventOutput,
  EventHandler,
  PluginManifest,
  ManifestAction,
  ManifestActionProperty,
  Endpoint,
  FrontendBundle,
  GzacApiResponse,
  Document,
  DocumentContent,
  DocumentDefinitionId,
} from "./models/index.js";
