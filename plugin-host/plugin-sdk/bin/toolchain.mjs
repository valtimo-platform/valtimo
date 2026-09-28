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
 * Shared Wasm build-toolchain provisioning for the Valtimo plugin SDK.
 *
 * Compiling a plugin to Wasm needs two external tools:
 *   - `extism-js`  — the Extism JS-PDK compiler (JS bundle → .wasm)
 *   - `binaryen`   — extism-js shells out to its `wasm-merge` and `wasm-opt` binaries
 *
 * Nobody should have to install these by hand. `ensureToolchain()` locates both — preferring
 * existing installs on PATH — and otherwise downloads the pinned versions from their GitHub
 * releases (with sha256 verification) into a local toolchain directory:
 *   - inside this repository:  `plugin-host/.bin/` (gitignored)
 *   - installed from npm:      `~/.valtimo-plugin-sdk/toolchain/`
 *
 * This module is consumed by the SDK's own CLIs (`valtimo-plugin-build`), by the monorepo
 * bootstrap scripts (`plugin-host/scripts/`), and by sample apps — one implementation for all
 * of them. It is also part of the published package as `@valtimo/plugin-sdk/toolchain`.
 *
 * Only Node builtins are used so it can run before any `npm install` has happened.
 *
 * Environment overrides:
 *   VALTIMO_PLUGIN_TOOLCHAIN_DIR  — where downloaded tools are stored
 *   VALTIMO_EXTISM_JS             — absolute path to an extism-js binary to use as-is
 *   EXTISM_JS_VERSION             — extism-js release to download (default pinned below)
 *   BINARYEN_VERSION              — binaryen release to download (default pinned below)
 */

import {execFileSync, spawnSync} from "node:child_process";
import {chmodSync, createWriteStream, existsSync, mkdirSync, renameSync, rmSync} from "node:fs";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {delimiter, dirname, join, resolve, sep} from "node:path";
import {createRequire} from "node:module";
import {fileURLToPath, pathToFileURL} from "node:url";
import {pipeline} from "node:stream/promises";
import {createGunzip} from "node:zlib";
import {Readable} from "node:stream";
import {arch, homedir, platform} from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Version pins — single source of truth for local builds and CI. Bump EXTISM_JS_VERSION together
// with the `@extism/js-pdk` dependency of the plugins/fixtures (compiler and PDK must match).
const DEFAULT_EXTISM_JS_VERSION = "v1.6.0";
const DEFAULT_BINARYEN_VERSION = "version_131";

export const EXTISM_JS_VERSION = normalizeExtismVersion(
  process.env.EXTISM_JS_VERSION || DEFAULT_EXTISM_JS_VERSION
);
export const BINARYEN_VERSION = normalizeBinaryenVersion(
  process.env.BINARYEN_VERSION || DEFAULT_BINARYEN_VERSION
);

function normalizeExtismVersion(v) {
  return v.startsWith("v") ? v : `v${v}`;
}

function normalizeBinaryenVersion(v) {
  return v.startsWith("version_") ? v : `version_${v}`;
}

const isWindows = platform() === "win32";
const EXE = isWindows ? ".exe" : "";

function defaultLog(message) {
  console.log(`[valtimo-plugin-toolchain] ${message}`);
}

/**
 * Directory downloaded tools are installed into. Inside the repository this is the gitignored
 * `plugin-host/.bin/`; for an npm-installed SDK it is a per-user cache so the toolchain survives
 * `node_modules` wipes and is shared between projects.
 */
export function toolchainInstallDir() {
  if (process.env.VALTIMO_PLUGIN_TOOLCHAIN_DIR) {
    return resolve(process.env.VALTIMO_PLUGIN_TOOLCHAIN_DIR);
  }
  const insideNodeModules = __dirname.split(sep).includes("node_modules");
  if (!insideNodeModules) {
    // bin/ → plugin-sdk/ → plugin-host/
    return resolve(__dirname, "..", "..", ".bin");
  }
  return join(homedir(), ".valtimo-plugin-sdk", "toolchain");
}

/** Returns true when `cmd --version` runs successfully (i.e. the tool is on PATH). */
function onPath(cmd) {
  try {
    execFileSync(cmd, ["--version"], {stdio: "pipe"});
    return true;
  } catch {
    return false;
  }
}

function releasePlatform() {
  const os = platform();
  const cpu = arch();
  const osName = os === "darwin" ? "macos" : os === "win32" ? "windows" : "linux";
  const isArm = cpu === "arm64" || cpu === "aarch64";
  return {osName, isArm};
}

async function download(url, destination, log) {
  log(`Downloading ${url}`);
  const res = await fetch(url, {redirect: "follow"});
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status} ${res.statusText} (${url})`);
  }
  mkdirSync(dirname(destination), {recursive: true});
  const partial = `${destination}.download`;
  rmSync(partial, {force: true});
  await pipeline(Readable.fromWeb(res.body), createWriteStream(partial));
  await verifySha256(url, partial, log);
  renameSync(partial, destination);
  return destination;
}

/**
 * Verifies a downloaded file against the `.sha256` sidecar published next to the release asset.
 * A mismatch is fatal; a missing sidecar only warns (older releases may not publish one).
 */
async function verifySha256(assetUrl, file, log) {
  let expected;
  try {
    const res = await fetch(`${assetUrl}.sha256`, {redirect: "follow"});
    if (!res.ok) throw new Error(`${res.status}`);
    const text = await res.text();
    expected = (text.match(/\b[0-9a-fA-F]{64}\b/) || [])[0];
  } catch {
    log(`Warning: no sha256 checksum published for ${assetUrl} — skipping verification`);
    return;
  }
  if (!expected) {
    log(`Warning: could not parse sha256 checksum for ${assetUrl} — skipping verification`);
    return;
  }
  const actual = createHash("sha256").update(await readFile(file)).digest("hex");
  if (actual !== expected.toLowerCase()) {
    rmSync(file, {force: true});
    throw new Error(`Checksum mismatch for ${assetUrl}: expected ${expected}, got ${actual}`);
  }
}

// ---------------------------------------------------------------------------
// extism-js
// ---------------------------------------------------------------------------

/**
 * Locates the extism-js compiler, downloading it when absent. Search order:
 *   1. `VALTIMO_EXTISM_JS` (explicit path)
 *   2. `extism-js` on PATH
 *   3. previously installed copies (toolchain dir, `node_modules/.bin`, `plugin-host/.bin`)
 *   4. download the pinned release into the toolchain dir
 *
 * Returns the command to execute (absolute path, or `extism-js` when found on PATH).
 */
export async function ensureExtismJs({log = defaultLog} = {}) {
  const explicit = process.env.VALTIMO_EXTISM_JS;
  if (explicit) {
    if (!existsSync(explicit)) {
      throw new Error(`VALTIMO_EXTISM_JS points to a non-existent file: ${explicit}`);
    }
    return explicit;
  }

  if (onPath("extism-js")) return "extism-js";

  const candidates = [
    join(toolchainInstallDir(), `extism-js${EXE}`),
    resolve(process.cwd(), "node_modules", ".bin", `extism-js${EXE}`),
    // Legacy in-repo location kept for compatibility (same as the toolchain dir inside the repo).
    resolve(__dirname, "..", "..", ".bin", `extism-js${EXE}`),
  ];
  for (const bin of candidates) {
    if (existsSync(bin)) return bin;
  }

  const {osName, isArm} = releasePlatform();
  const archName = isArm ? "aarch64" : "x86_64";
  const fileName = `extism-js-${archName}-${osName}-${EXTISM_JS_VERSION}.gz`;
  const url = `https://github.com/extism/js-pdk/releases/download/${EXTISM_JS_VERSION}/${fileName}`;

  const dest = join(toolchainInstallDir(), `extism-js${EXE}`);
  log(`Installing extism-js ${EXTISM_JS_VERSION} (${osName}/${archName}) ...`);
  const gz = await download(url, `${dest}.gz`, log);
  await pipeline(
    Readable.from(await readFile(gz)),
    createGunzip(),
    createWriteStream(dest)
  );
  rmSync(gz, {force: true});
  chmodSync(dest, 0o755);
  log(`Installed extism-js to ${dest}`);
  return dest;
}

// ---------------------------------------------------------------------------
// binaryen (wasm-merge / wasm-opt)
// ---------------------------------------------------------------------------

/**
 * Ensures binaryen's `wasm-merge` and `wasm-opt` are available, downloading the pinned release
 * when absent. Returns the directory to prepend to PATH, or `null` when both tools are already
 * on PATH (e.g. installed via `brew install binaryen`).
 */
export async function ensureBinaryen({log = defaultLog} = {}) {
  if (onPath("wasm-merge") && onPath("wasm-opt")) return null;

  const installDir = toolchainInstallDir();
  const binDir = join(installDir, `binaryen-${BINARYEN_VERSION}`, "bin");
  if (existsSync(join(binDir, `wasm-merge${EXE}`)) && existsSync(join(binDir, `wasm-opt${EXE}`))) {
    return binDir;
  }

  const {osName, isArm} = releasePlatform();
  // Binaryen's release assets name the arm64 flavours inconsistently: `aarch64-linux`,
  // but `arm64-macos` and `arm64-windows`.
  const archName = isArm ? (osName === "linux" ? "aarch64" : "arm64") : "x86_64";
  const fileName = `binaryen-${BINARYEN_VERSION}-${archName}-${osName}.tar.gz`;
  const url = `https://github.com/WebAssembly/binaryen/releases/download/${BINARYEN_VERSION}/${fileName}`;

  log(`Installing binaryen ${BINARYEN_VERSION} (${osName}/${archName}) — needed by extism-js ...`);
  const archive = await download(url, join(installDir, fileName), log);

  // Extract with the system tar: present on Linux, macOS, and Windows 10+ (bsdtar).
  const result = spawnSync("tar", ["-xzf", archive, "-C", installDir], {stdio: "inherit"});
  rmSync(archive, {force: true});
  if (result.error || result.status !== 0) {
    throw new Error(
      `Failed to extract ${fileName} with 'tar'. Install binaryen manually ` +
        `(https://github.com/WebAssembly/binaryen/releases) and put wasm-merge/wasm-opt on your PATH.`
    );
  }
  if (!existsSync(join(binDir, `wasm-merge${EXE}`))) {
    throw new Error(`binaryen archive did not contain the expected layout at ${binDir}`);
  }
  log(`Installed binaryen to ${dirname(binDir)}`);
  return binDir;
}

// ---------------------------------------------------------------------------
// Combined toolchain
// ---------------------------------------------------------------------------

/**
 * Ensures the full plugin build toolchain is available.
 *
 * Returns `{ extismJs, env }`: the extism-js command to execute and an environment whose PATH
 * includes the binaryen binaries — extism-js resolves `wasm-merge`/`wasm-opt` from the PATH of
 * its own process, so always spawn it with this env.
 */
export async function ensureToolchain({log = defaultLog} = {}) {
  const extismJs = await ensureExtismJs({log});
  const binaryenBinDir = await ensureBinaryen({log});

  const env = {...process.env};
  if (binaryenBinDir) {
    env.PATH = `${binaryenBinDir}${delimiter}${env.PATH ?? ""}`;
  }
  return {extismJs, env};
}

// ---------------------------------------------------------------------------
// esbuild
// ---------------------------------------------------------------------------

/**
 * Runs an esbuild build using the esbuild installed in the consuming project (`cwd`), via its JS
 * API. This replaces shelling out to `npx esbuild`, which is not portable to Windows.
 */
export async function runEsbuild(cwd, buildOptions) {
  const require = createRequire(join(cwd, "package.json"));
  let esbuildMain;
  try {
    esbuildMain = require.resolve("esbuild");
  } catch {
    throw new Error(
      `esbuild is not installed in ${cwd}. Add it as a devDependency and run 'npm install'.`
    );
  }
  const esbuild = await import(pathToFileURL(esbuildMain).href);
  // logLevel "warning" mirrors the esbuild CLI: diagnostics go to stderr (the JS API is silent
  // by default).
  await esbuild.build({absWorkingDir: cwd, logLevel: "warning", ...buildOptions});
}
