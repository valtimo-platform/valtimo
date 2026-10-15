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

import {execFileSync} from "node:child_process";
import {chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {
  EXTISM_JS_BIN,
  FIXTURE_DIR,
  FIXTURE_MANIFEST,
  FIXTURE_WASM,
  LEGACY_FIXTURE_DIR,
  LEGACY_FIXTURE_WASM,
} from "./fixture.js";

/**
 * Compiles the fixture plugin to Wasm before the L3 suite runs, using the real SDK toolchain
 * (`valtimo-plugin-build` → esbuild → extism-js). The build tooling finds extism-js on PATH, so the
 * `.bin` dir is prepended. Fails loudly with remediation steps if a prerequisite is missing.
 */
export default async function setup(): Promise<void> {
  if (!existsSync(join(FIXTURE_DIR, "node_modules"))) {
    throw new Error(
      `Fixture dependencies are not installed.\n  Run: (cd ${FIXTURE_DIR} && npm install)`
    );
  }

  const env = { ...process.env };
  if (existsSync(EXTISM_JS_BIN)) {
    try {
      chmodSync(EXTISM_JS_BIN, 0o755);
    } catch {
      // best-effort; a read-only mount would keep whatever mode is already set
    }
    env.PATH = `${dirname(EXTISM_JS_BIN)}:${env.PATH ?? ""}`;
  }

  try {
    execFileSync("npm", ["run", "build"], { cwd: FIXTURE_DIR, env, stdio: "pipe" });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      "Failed to build the fixture Wasm plugin.\n" +
        `  extism-js expected at: ${EXTISM_JS_BIN} (or on PATH)\n` +
        "  Ensure the SDK is built (cd plugin-host/plugin-sdk && npm run build).\n" +
        `  Underlying error: ${detail}`
    );
  }

  if (!existsSync(FIXTURE_WASM)) {
    throw new Error(`Fixture build reported success but produced no Wasm at ${FIXTURE_WASM}`);
  }

  buildLegacyFixture(env);
}

/**
 * Builds the fixture once more from a scratch directory whose manifest declares no contracts, so
 * the L3 suite can check which host imports the build tool emits for a contract-free plugin.
 */
function buildLegacyFixture(env: NodeJS.ProcessEnv): void {
  rmSync(LEGACY_FIXTURE_DIR, { recursive: true, force: true });
  mkdirSync(LEGACY_FIXTURE_DIR, { recursive: true });
  const manifest = JSON.parse(readFileSync(FIXTURE_MANIFEST, "utf-8"));
  delete manifest.provides;
  delete manifest.permissions;
  writeFileSync(join(LEGACY_FIXTURE_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));

  const buildTool = join(FIXTURE_DIR, "node_modules", "@valtimo", "plugin-sdk", "bin", "valtimo-plugin-build.mjs");
  try {
    execFileSync(
      process.execPath,
      [buildTool, "--input", join(FIXTURE_DIR, "src", "plugin.ts"), "--output", "plugin.wasm"],
      { cwd: LEGACY_FIXTURE_DIR, env, stdio: "pipe" }
    );
  } catch (err) {
    throw new Error(`Failed to build the contract-free fixture: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!existsSync(LEGACY_FIXTURE_WASM)) {
    throw new Error(`Contract-free fixture build produced no Wasm at ${LEGACY_FIXTURE_WASM}`);
  }
}
