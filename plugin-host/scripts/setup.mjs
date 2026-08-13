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
 * One-shot setup for the plugin-host monorepo: installs and builds every package in dependency
 * order and provisions the Wasm toolchain, so a fresh checkout reaches a runnable state with a
 * single command. Idempotent — safe to re-run at any time.
 *
 *   npm run setup           # from plugin-host/
 *   npm run setup -- --ci   # reproducible installs (npm ci), used on CI
 *
 * Order matters: the app, the sample plugin, the demo app, and the test fixture all depend on
 * `@valtimo/plugin-sdk` as a `file:` link, so the SDK must be installed AND built before anything
 * that imports it runs.
 */

import {existsSync, readFileSync} from "node:fs";
import {join} from "node:path";
import {pathToFileURL} from "node:url";
import {
  APP_DIR,
  DEMO_APP_DIR,
  ROOT,
  SAMPLE_PLUGIN_DIR,
  SDK_DIR,
  TEST_FIXTURE_DIR,
  checkNodeVersion,
  dockerIsRunning,
  info,
  note,
  runNpm,
  step,
} from "./lib/common.mjs";

/** dist/<pluginId>-<version>.zip as produced by `valtimo-plugin-pack`, derived from the manifest. */
export function samplePluginZipPath() {
  const manifest = JSON.parse(readFileSync(join(SAMPLE_PLUGIN_DIR, "manifest.json"), "utf-8"));
  return join(SAMPLE_PLUGIN_DIR, "dist", `${manifest.pluginId}-${manifest.version}.zip`);
}

/** Cheap staleness check used by `npm run dev` to decide whether setup must run first. */
export function needsSetup() {
  return (
    !existsSync(join(SDK_DIR, "node_modules")) ||
    !existsSync(join(SDK_DIR, "dist", "index.js")) ||
    !existsSync(join(APP_DIR, "node_modules")) ||
    !existsSync(join(SAMPLE_PLUGIN_DIR, "node_modules")) ||
    !existsSync(samplePluginZipPath())
  );
}

function install(dir, ci) {
  // `npm ci` needs a lockfile; the sample/fixture packages fall back to `npm install` without one.
  const useCi = ci && existsSync(join(dir, "package-lock.json"));
  runNpm([useCi ? "ci" : "install"], {cwd: dir});
}

export async function runSetup({ci = false} = {}) {
  const started = Date.now();

  step("Plugin SDK — install & build (everything else depends on it)");
  install(SDK_DIR, ci);
  runNpm(["run", "build"], {cwd: SDK_DIR});

  step("Plugin Host app — install & build");
  install(APP_DIR, ci);
  runNpm(["run", "build"], {cwd: APP_DIR});

  step("Sample plugin (case-summary) — install");
  install(SAMPLE_PLUGIN_DIR, ci);

  step("Demo app — install & build");
  install(DEMO_APP_DIR, ci);
  runNpm(["run", "build"], {cwd: DEMO_APP_DIR});

  step("Test fixture plugin — install (used by the Wasm test suite)");
  install(TEST_FIXTURE_DIR, ci);

  step("Wasm toolchain — extism-js + binaryen");
  // Shared with the SDK's own build CLI: existing installs on PATH are used as-is, anything
  // missing is downloaded into plugin-host/.bin/ (gitignored).
  const toolchain = await import(
    pathToFileURL(join(SDK_DIR, "bin", "toolchain.mjs")).href
  );
  const extismJs = await toolchain.ensureExtismJs({log: info});
  const binaryenBinDir = await toolchain.ensureBinaryen({log: info});
  info(`extism-js: ${extismJs === "extism-js" ? "found on PATH" : extismJs}`);
  info(`binaryen:  ${binaryenBinDir ?? "found on PATH (wasm-merge, wasm-opt)"}`);

  step("Sample plugin (case-summary) — compile to Wasm & pack");
  runNpm(["run", "build:pack"], {cwd: SAMPLE_PLUGIN_DIR});

  const seconds = Math.round((Date.now() - started) / 1000);
  step(`Setup complete in ${seconds}s`);
  info(`Sample plugin package: ${samplePluginZipPath()}`);
  if (!dockerIsRunning()) {
    note("Docker is not running — 'npm run dev' needs it for the host's PostgreSQL.");
  }
  info("Next: 'npm run dev' starts PostgreSQL + the plugin host and uploads the sample plugin.");
}

// CLI entry point (also importable from dev.mjs). The comparison is case-insensitive because on
// Windows the drive letter casing of argv[1] and import.meta.url can differ.
const invokedDirectly =
  process.argv[1] &&
  import.meta.url.toLowerCase() === pathToFileURL(process.argv[1]).href.toLowerCase();
if (invokedDirectly) {
  checkNodeVersion();
  const ci = process.argv.includes("--ci");
  note(`plugin-host setup (node ${process.versions.node}${ci ? ", npm ci mode" : ""}) in ${ROOT}`);
  runSetup({ci}).catch((err) => {
    console.error(`\n✖ Setup failed: ${err.message}`);
    process.exit(1);
  });
}
