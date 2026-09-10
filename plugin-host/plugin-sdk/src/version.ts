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

import {createRequire} from 'node:module';

/**
 * Version of this @valtimo/plugin-sdk package, read from its own package.json so the two can never
 * disagree. Node-only, and deliberately kept out of the SDK's main entry: that entry is bundled into
 * plugin.wasm by esbuild with platform "neutral", where an import of node:module would fail to
 * resolve. Only the packaging CLI imports this.
 */
export const SDK_VERSION: string = createRequire(import.meta.url)('../package.json').version;
