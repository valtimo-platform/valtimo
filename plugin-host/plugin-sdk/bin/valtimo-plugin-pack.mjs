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
 * Frontend bundles are built automatically: for every .html file in frontend/
 * that references a <script src="*.bundle.js">, the pack script looks for a
 * matching source file (.tsx, .ts, .jsx, .js) and compiles it with esbuild.
 * The generated .bundle.js files are included in the zip and removed afterwards.
 *
 * Output: {pluginId}-{version}.zip
 *
 * Usage: valtimo-plugin-pack [--wasm plugin.wasm] [--manifest manifest.json] [--output .]
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, mkdirSync, unlinkSync } from "node:fs";
import { resolve, join, basename, extname } from "node:path";
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

// ---- Build frontend bundles ----

const SOURCE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];
const builtBundles = [];

if (hasFrontend) {
  const htmlFiles = readdirSync(frontendDir).filter(f => f.endsWith(".html"));

  for (const htmlFile of htmlFiles) {
    const htmlContent = readFileSync(join(frontendDir, htmlFile), "utf-8");
    const scriptMatch = htmlContent.match(/<script\s+src="([^"]+\.bundle\.js)"/);
    if (!scriptMatch) continue;

    const bundleName = scriptMatch[1]; // e.g. "config.bundle.js"
    const baseName = bundleName.replace(".bundle.js", ""); // e.g. "config"

    // Find matching source file
    let sourceFile = null;
    for (const ext of SOURCE_EXTENSIONS) {
      const candidate = join(frontendDir, baseName + ext);
      if (existsSync(candidate)) {
        sourceFile = candidate;
        break;
      }
    }

    if (!sourceFile) continue;

    const outFile = join(frontendDir, bundleName);
    const sourceExt = extname(sourceFile);
    const loader = sourceExt === ".tsx" ? "tsx" : sourceExt === ".jsx" ? "jsx" : "ts";

    console.log(`[valtimo-plugin-pack] Building frontend bundle: ${baseName}${sourceExt} -> ${bundleName}`);

    try {
      execFileSync("npx", [
        "esbuild", sourceFile,
        "--bundle", `--outfile=${outFile}`,
        "--format=iife", "--target=es2020",
        "--jsx=automatic", `--loader:${sourceExt}=${loader}`,
      ], { cwd, stdio: "inherit" });
      builtBundles.push(outFile);
    } catch (err) {
      console.error(`[valtimo-plugin-pack] Failed to build frontend bundle: ${bundleName}`);
      // Clean up any bundles built so far
      for (const built of builtBundles) {
        if (existsSync(built)) unlinkSync(built);
      }
      process.exit(1);
    }
  }
}

// ---- Detect plugin logo ----
// Convention: a single `logo.{svg,png,jpg,jpeg}` next to manifest.json. First match wins.
const LOGO_EXTENSIONS = [".svg", ".png", ".jpg", ".jpeg"];
let logoFile = null;
for (const ext of LOGO_EXTENSIONS) {
  const candidate = join(cwd, `logo${ext}`);
  if (existsSync(candidate)) {
    logoFile = candidate;
    break;
  }
}

// ---- Create zip ----

try {
  const zip = new AdmZip();
  // If a logo was found, set its filename on the manifest so the host knows what file to serve
  // at GET /plugins/:id/:version/logo. We write the modified manifest into the zip rather than
  // touching the user's source manifest.json.
  const manifestForZip = logoFile
    ? { ...manifest, logo: basename(logoFile) }
    : manifest;
  zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifestForZip, null, 2), "utf-8"));
  zip.addLocalFile(wasmPath, "", "plugin.wasm");
  if (logoFile) {
    zip.addLocalFile(logoFile, "", basename(logoFile));
    console.log(`[valtimo-plugin-pack] Included logo: ${basename(logoFile)}`);
  }

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

  // Clean up generated frontend bundles
  for (const built of builtBundles) {
    if (existsSync(built)) {
      unlinkSync(built);
    }
  }

  console.log(`[valtimo-plugin-pack] Created: ${zipName}`);
} catch (err) {
  // Clean up generated frontend bundles on error too
  for (const built of builtBundles) {
    if (existsSync(built)) unlinkSync(built);
  }
  console.error("[valtimo-plugin-pack] Packaging failed:", err.message);
  process.exit(1);
}
