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
 * valtimo-plugin-build
 *
 * Compiles a plugin's TypeScript source to a .wasm module using extism-js.
 *
 * Steps:
 * 1. Bundle the plugin TS/JS source into a single JS file (via esbuild)
 * 2. Compile the bundled JS to .wasm via the extism-js CLI
 *
 * Usage: valtimo-plugin-build [--input src/plugin.ts] [--output plugin.wasm]
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const inputIdx = args.indexOf("--input");
const outputIdx = args.indexOf("--output");

const input = inputIdx >= 0 ? args[inputIdx + 1] : "src/plugin.ts";
const output = outputIdx >= 0 ? args[outputIdx + 1] : "plugin.wasm";

const cwd = process.cwd();
const inputPath = resolve(cwd, input);
const outputPath = resolve(cwd, output);
const bundlePath = resolve(cwd, "dist", "_plugin_bundle.js");

if (!existsSync(inputPath)) {
  console.error(`Error: Input file not found: ${inputPath}`);
  process.exit(1);
}

console.log(`[valtimo-plugin-build] Bundling ${input} ...`);

// Ensure dist directory exists
mkdirSync(dirname(bundlePath), { recursive: true });

// Step 1: Bundle with esbuild to a single JS file
// We use the Extism JS PDK's expected format: module-level code that registers handlers
try {
  execSync(
    `npx esbuild "${inputPath}" --bundle --outfile="${bundlePath}" --format=cjs --target=es2020 --platform=neutral --main-fields=main --external:@extism/js-pdk`,
    { cwd, stdio: "inherit" }
  );
} catch (err) {
  console.error("[valtimo-plugin-build] esbuild bundling failed");
  process.exit(1);
}

// Step 2: Compile to .wasm via extism-js
console.log(`[valtimo-plugin-build] Compiling to WebAssembly ...`);

// Resolve extism-js binary: check PATH first, then known local locations
function findExtismJs() {
  try {
    execSync("extism-js --version", { stdio: "pipe" });
    return "extism-js";
  } catch {}

  // Check local .bin directory (monorepo convention)
  const localBin = resolve(cwd, "node_modules", ".bin", "extism-js");
  if (existsSync(localBin)) return localBin;

  // Check .bin directories in the monorepo
  const searchDirs = [
    resolve(__dirname, "..", "..", ".bin", "extism-js"),       // plugin-host/.bin/
    resolve(__dirname, "..", "..", "..", ".bin", "extism-js"),  // repo root .bin/
  ];
  for (const bin of searchDirs) {
    if (existsSync(bin)) return bin;
  }

  return null;
}

const extismJsBin = findExtismJs();
if (!extismJsBin) {
  console.error("[valtimo-plugin-build] extism-js CLI not found.");
  console.error("Install it from: https://github.com/nicholasgasior/extism/js-pdk/releases");
  console.error("Or place it in sdks/.bin/extism-js for local development.");
  process.exit(1);
}

try {
  // Look for index.d.ts in the plugin directory (declares exported functions)
  const interfaceFile = resolve(cwd, "index.d.ts");
  const iFlag = existsSync(interfaceFile) ? `-i "${interfaceFile}"` : "";
  execSync(`"${extismJsBin}" "${bundlePath}" -o "${outputPath}" ${iFlag}`, {
    cwd,
    stdio: "inherit",
  });
  console.log(`[valtimo-plugin-build] Built: ${output}`);
} catch (err) {
  console.error("[valtimo-plugin-build] extism-js compilation failed");
  process.exit(1);
}
