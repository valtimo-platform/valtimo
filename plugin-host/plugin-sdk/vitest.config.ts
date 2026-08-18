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

export default defineConfig({
  test: {
    // Default node environment; the frontend SDK spec opts into happy-dom via a per-file
    // `// @vitest-environment happy-dom` docblock and picks up the URL below.
    environment: "node",
    include: ["src/**/*.test.ts"],
    environmentOptions: {
      happyDOM: {
        // The frontend SDK derives the manifest URL from window.location.href, which must match
        // /plugins/{id}/{version}/... — see _loadManifest.
        url: "http://host.example:8090/plugins/case-summary/0.1.0/case-tab.html",
      },
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "dist/**",
        // Test scaffolding (Extism Host/Memory doubles), not shipped product code.
        "src/test-support/**",
        "src/models/**",
        "src/index.ts",
        "src/frontend/index.ts",
      ],
      reporter: ["text", "html"],
    },
  },
});
