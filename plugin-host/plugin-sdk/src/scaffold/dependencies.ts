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
 * The devDependency ranges written into a generated plugin's package.json, in one place.
 *
 * Keep in step with sample-plugins/case-summary/package.json — a scaffold that pins older ranges
 * than the reference sample is the first thing to rot.
 */

/**
 * Needed by every plugin: `@extism/js-pdk` supplies the Wasm globals the SDK compiles against,
 * esbuild is resolved from the plugin's *own* node_modules by the build tool, and typescript is
 * what type-checks the project (`npx tsc`).
 */
export const BASE_DEV_DEPENDENCIES = {
  "@extism/js-pdk": "^1.1.0",
  esbuild: "^0.25.0",
  typescript: "^5.4.0",
} as const;

/** Added only when a frontend bundle is generated — a backend-only plugin needs no React. */
export const FRONTEND_DEV_DEPENDENCIES = {
  react: "^19.0.0",
  "react-dom": "^19.0.0",
  "@types/react": "^19.0.0",
  "@types/react-dom": "^19.0.0",
} as const;
