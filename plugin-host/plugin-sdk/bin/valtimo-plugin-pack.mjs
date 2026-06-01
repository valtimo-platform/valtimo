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
 * valtimo-plugin-pack
 *
 * Assembles a plugin .zip package containing:
 *   - manifest.json (from project root)
 *   - plugin.wasm (from project root or dist/)
 *   - frontend/ directory (if present)
 *
 * Output: {pluginId}-{version}.zip
 *
 * Usage: valtimo-plugin-pack [--wasm plugin.wasm] [--manifest manifest.json] [--output .]
 */

import { existsSync, readFileSync, mkdirSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip");

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const cwd = process.cwd();
const manifestPath = resolve(cwd, getArg("manifest") || "manifest.json");
const wasmPath = resolve(cwd, getArg("wasm") || "plugin.wasm");
const outputDir = resolve(cwd, getArg("output") || ".");

if (!existsSync(manifestPath)) {
  console.error(`Error: manifest.json not found at: ${manifestPath}`);
  process.exit(1);
}

if (!existsSync(wasmPath)) {
  console.error(`Error: plugin.wasm not found at: ${wasmPath}`);
  console.error("Did you run 'valtimo-plugin-build' first?");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
const pluginId = manifest.pluginId;
const version = manifest.version;

if (!pluginId || !version) {
  console.error(
    "Error: manifest.json must contain 'pluginId' and 'version' fields"
  );
  process.exit(1);
}

const zipName = `${pluginId}-${version}.zip`;
const zipPath = resolve(outputDir, zipName);

console.log(`[valtimo-plugin-pack] Packing ${pluginId}@${version} ...`);

mkdirSync(outputDir, { recursive: true });

const frontendDir = resolve(cwd, "frontend");
const hasFrontend = existsSync(frontendDir);

try {
  const zip = new AdmZip();
  zip.addLocalFile(manifestPath, "", "manifest.json");
  zip.addLocalFile(wasmPath, "", "plugin.wasm");

  if (hasFrontend) {
    zip.addLocalFolder(frontendDir, "frontend");
  }

  zip.writeZip(zipPath);

  // Remove intermediate build artifacts from the output directory
  const bundlePath = resolve(outputDir, "_plugin_bundle.js");
  const wasmInOutput = resolve(outputDir, "plugin.wasm");
  for (const artifact of [bundlePath, wasmInOutput]) {
    if (existsSync(artifact)) {
      unlinkSync(artifact);
    }
  }

  console.log(`[valtimo-plugin-pack] Created: ${zipName}`);
} catch (err) {
  console.error("[valtimo-plugin-pack] Packaging failed:", err.message);
  process.exit(1);
}
