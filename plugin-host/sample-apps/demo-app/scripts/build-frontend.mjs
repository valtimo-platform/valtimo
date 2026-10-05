#!/usr/bin/env node

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
 * Builds the iframe bundles the app serves at `/plugins/{pluginId}/{version}/bundles/*`.
 *
 * For every `frontend/*.html` that references a `<script src="*.bundle.js">`, the matching `*.tsx`
 * is compiled with esbuild and written to `public/`, alongside a copy of the `.html`. This mirrors
 * exactly what `valtimo-plugin-pack` does for uploaded plugins — the only difference is that an app
 * serves the built files directly rather than zipping them.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runEsbuild } from "@valtimo/plugin-sdk/toolchain";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const frontendDir = join(projectRoot, "frontend");
const publicDir = join(projectRoot, "public");

mkdirSync(publicDir, { recursive: true });

const htmlFiles = readdirSync(frontendDir).filter((f) => f.endsWith(".html"));

for (const htmlFile of htmlFiles) {
  const htmlContent = readFileSync(join(frontendDir, htmlFile), "utf-8");
  const scriptMatch = htmlContent.match(/<script\s+src="([^"]+\.bundle\.js)"/);
  copyFileSync(join(frontendDir, htmlFile), join(publicDir, htmlFile));

  if (!scriptMatch) continue;
  const bundleName = scriptMatch[1]; // e.g. "config.bundle.js"
  const baseName = bundleName.replace(".bundle.js", "");
  const sourceFile = join(frontendDir, `${baseName}.tsx`);
  if (!existsSync(sourceFile)) {
    console.error(`[build-frontend] No source for ${bundleName} (expected ${baseName}.tsx)`);
    process.exit(1);
  }

  console.log(`[build-frontend] ${baseName}.tsx -> public/${bundleName}`);
  await runEsbuild(projectRoot, {
    entryPoints: [sourceFile],
    bundle: true,
    outfile: join(publicDir, bundleName),
    format: "iife",
    target: "es2020",
    jsx: "automatic",
    loader: { ".tsx": "tsx" },
  });
}

console.log("[build-frontend] done");
