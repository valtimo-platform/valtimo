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
 * Shared helpers for the plugin-host bootstrap scripts. Node builtins only — these scripts must
 * run on a fresh checkout, before any `npm install`, on Linux, macOS, and Windows.
 */

import {spawn, spawnSync} from "node:child_process";
import {delimiter, dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

export const isWindows = process.platform === "win32";

/** Absolute path of the plugin-host directory (the root of this mini-monorepo). */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const SDK_DIR = join(ROOT, "plugin-sdk");
export const APP_DIR = join(ROOT, "app");
export const SAMPLE_PLUGIN_DIR = join(ROOT, "sample-plugins", "case-summary");
export const DEMO_APP_DIR = join(ROOT, "sample-apps", "demo-app");
export const TEST_FIXTURE_DIR = join(ROOT, "test-fixtures", "test-plugin");

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const bold = (s) => (useColor ? `\x1b[1m${s}\x1b[0m` : s);
const dim = (s) => (useColor ? `\x1b[2m${s}\x1b[0m` : s);

export function step(title) {
  console.log(`\n${bold(`▸ ${title}`)}`);
}

export function info(message) {
  console.log(`  ${message}`);
}

export function note(message) {
  console.log(dim(`  ${message}`));
}

export function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

/**
 * The plugin host requires Node >= 22 (Extism's `runInWorker`). Check up front with a clear
 * message instead of letting an obscure runtime error surface later.
 */
export function checkNodeVersion() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 22) {
    fail(
      `Node ${process.versions.node} detected, but the plugin host requires Node >= 22.\n` +
        `  Install it via your version manager (e.g. 'nvm use' picks up plugin-host/.nvmrc) or from https://nodejs.org.`
    );
  }
}

/** Runs a command synchronously, streaming output. Throws when the command fails. */
export function run(cmd, args, {cwd = ROOT, env = process.env} = {}) {
  note(`$ ${cmd} ${args.join(" ")}  ${dim(`(${cwd})`)}`);
  // Windows: npm/npx are .cmd shims, which Node only executes through a shell.
  const shell = isWindows && /^(npm|npx|tsx)(\.cmd)?$/i.test(cmd);
  const result = spawnSync(cmd, args, {cwd, env, stdio: "inherit", shell});
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Command failed with exit code ${result.status}: ${cmd} ${args.join(" ")}`);
  }
}

export function runNpm(args, opts = {}) {
  run("npm", args, opts);
}

/** Spawns a long-running child (the dev server), inheriting stdio. Returns the ChildProcess. */
export function spawnLongRunning(cmd, args, {cwd, env}) {
  const shell = isWindows && /^(npm|npx|tsx)(\.cmd)?$/i.test(cmd);
  return spawn(cmd, args, {cwd, env, stdio: "inherit", shell});
}

/** Returns an env whose PATH is prepended with the given directories. */
export function envWithPath(dirs, base = process.env) {
  return {...base, PATH: [...dirs, base.PATH ?? ""].join(delimiter)};
}

/** True when the Docker CLI exists and the daemon responds. */
export function dockerIsRunning() {
  const result = spawnSync("docker", ["info"], {stdio: "ignore"});
  return !result.error && result.status === 0;
}
