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

import {defineConfig} from "vitest/config";

/**
 * L3 (Wasm/Extism) test config — kept separate from the fast unit config so `npm test` never
 * depends on the extism-js toolchain. `globalSetup` compiles the fixture plugin to Wasm first.
 *
 * Run with `npm run test:wasm`. Requires Node >= 22 (Extism `runInWorker`) for the PluginManager
 * suite; the raw-Extism dispatch suite works on any supported Node.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/wasm/**/*.test.ts"],
    globalSetup: ["test/wasm/global-setup.ts"],
    // Compiling the fixture + spawning Extism workers is slower than a unit test.
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
