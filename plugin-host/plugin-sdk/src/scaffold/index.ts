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

/**
 * Public surface of the plugin scaffold, exposed as `@valtimo/plugin-sdk/scaffold` for
 * `bin/valtimo-plugin-init.mjs` — the same self-referencing subpath trick the pack tool uses for
 * `./manifest-validation`.
 *
 * Deliberately **not** re-exported from `src/index.ts`: everything there is bundled into Wasm by
 * `valtimo-plugin-build`, and this code imports `node:fs` and `node:readline`.
 */

export {
  DEFAULT_BUNDLES,
  DEFAULT_DESCRIPTION,
  DEFAULT_LOCALE,
  DEFAULT_VERSION,
  ScaffoldError,
  pluginIdFromDirectoryName,
  resolveOptions,
  titleCaseFromPluginId,
} from "./options.js";
export type {PartSelection, RawScaffoldInput, ScaffoldOptions} from "./options.js";

export {
  BUNDLE_IDS,
  HANDLER_FRAGMENTS,
  PARTS,
  PART_IDS,
  hasFrontend,
  isBundleId,
  selectedHandlers,
  selectedParts,
} from "./parts.js";
export type {HandlerId, PartContext, PartDescriptor, PartFrontend, PartId} from "./parts.js";

export {BASE_DEV_DEPENDENCIES, FRONTEND_DEV_DEPENDENCIES} from "./dependencies.js";

export {buildManifest, buildPackageJson, buildTsConfig} from "./json-files.js";
export type {GeneratedPackageJson, GeneratedTsConfig} from "./json-files.js";

export {
  TEMPLATE_PATHS,
  TOKEN_PATTERN,
  buildSdkImports,
  renderPluginSource,
  renderReadme,
  renderTemplateFile,
  substituteTokens,
  templateTokens,
} from "./render.js";

export {generatePlugin} from "./generate.js";
export type {GenerateResult} from "./generate.js";

export {runWizard} from "./prompts.js";
