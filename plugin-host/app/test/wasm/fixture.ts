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

import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const here = dirname(fileURLToPath(import.meta.url)); // <app>/test/wasm

/** plugin-host root (…/plugin-host). */
export const PLUGIN_HOST_ROOT = resolve(here, "..", "..", "..");

/** The fixture plugin directory and its compiled Wasm module + manifest. */
export const FIXTURE_DIR = join(PLUGIN_HOST_ROOT, "test-fixtures", "test-plugin");
export const FIXTURE_WASM = join(FIXTURE_DIR, "dist", "plugin.wasm");
export const FIXTURE_MANIFEST = join(FIXTURE_DIR, "manifest.json");
export const FIXTURE_PLUGIN_ID = "test-plugin";
export const FIXTURE_VERSION = "1.0.0";

/** The extism-js compiler location the build tooling and CI both use. */
export const EXTISM_JS_BIN = join(PLUGIN_HOST_ROOT, ".bin", "extism-js");

export const NODE_MAJOR = Number(process.versions.node.split(".")[0]);
