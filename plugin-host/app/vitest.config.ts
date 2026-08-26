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
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Exclude tests, generated output, and thin type/wiring modules that carry no logic.
      exclude: [
        "src/**/*.test.ts",
        "dist/**",
        "src/test-support/**",
        // Type/re-export-only modules (app-config keeps real zod logic and stays counted).
        "src/models/index.ts",
        "src/models/host-logger.ts",
        "src/models/plugin-configuration.ts",
        "src/models/plugin-manifest.ts",
        // Bootstrap wiring; buildHttpsOptions was extracted to https-options.ts for testing.
        "src/index.ts",
        // Bootstrap wiring for the standalone migrate entry point; same rationale as src/index.ts.
        "src/migrate.ts",
      ],
      reporter: ["text", "html"],
    },
  },
});
