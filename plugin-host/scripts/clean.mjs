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
 * Removes build output across the plugin-host packages (cross-platform `rm -rf`).
 *
 *   npm run clean          # build output only
 *   npm run clean -- --deep  # also node_modules and the downloaded toolchain (.bin/)
 */

import {existsSync, rmSync} from "node:fs";
import {join} from "node:path";
import {
  APP_DIR,
  DEMO_APP_DIR,
  ROOT,
  SAMPLE_PLUGIN_DIR,
  SDK_DIR,
  TEST_FIXTURE_DIR,
  info,
  step,
} from "./lib/common.mjs";

const deep = process.argv.includes("--deep");

const buildOutput = [
  join(SDK_DIR, "dist"),
  join(APP_DIR, "dist"),
  join(APP_DIR, ".tmp"),
  join(APP_DIR, "plugins"),
  join(SAMPLE_PLUGIN_DIR, "dist"),
  join(DEMO_APP_DIR, "dist"),
  join(DEMO_APP_DIR, "public"),
  join(TEST_FIXTURE_DIR, "dist"),
];

const deepTargets = [
  join(SDK_DIR, "node_modules"),
  join(APP_DIR, "node_modules"),
  join(SAMPLE_PLUGIN_DIR, "node_modules"),
  join(DEMO_APP_DIR, "node_modules"),
  join(TEST_FIXTURE_DIR, "node_modules"),
  join(ROOT, ".bin"),
];

step(deep ? "Cleaning build output, node_modules, and toolchain" : "Cleaning build output");
for (const target of deep ? [...buildOutput, ...deepTargets] : buildOutput) {
  if (existsSync(target)) {
    rmSync(target, {recursive: true, force: true});
    info(`removed ${target}`);
  }
}
