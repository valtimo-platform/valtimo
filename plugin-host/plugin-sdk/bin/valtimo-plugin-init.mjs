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
 * valtimo-plugin-init
 *
 * Scaffolds a new Valtimo external plugin project: manifest.json, package.json, tsconfig.json,
 * src/plugin.ts with a registered action, and optionally an onEvent handler plus any of the six
 * frontend bundle types, each with its backend counterpart.
 *
 * Interactive by default on a TTY; fully flag-driven otherwise (and under --yes).
 *
 * All the logic lives in `@valtimo/plugin-sdk/scaffold` (unit-tested TypeScript under `src/`) —
 * this file only parses argv, decides whether to prompt, installs dependencies, and prints what
 * to do next.
 *
 * Usage: valtimo-plugin-init [directory] [options]
 */

import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {relative, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {
  BUNDLE_IDS,
  DEFAULT_BUNDLES,
  DEFAULT_DESCRIPTION,
  DEFAULT_VERSION,
  PARTS,
  ScaffoldError,
  generatePlugin,
  pluginIdFromDirectoryName,
  resolveOptions,
  runWizard,
} from "@valtimo/plugin-sdk/scaffold";

const LOG_PREFIX = "[valtimo-plugin-init]";

// Rendered from the same descriptors the wizard legend uses, so --help and the wizard cannot drift.
const BUNDLE_WIDTH = Math.max(...BUNDLE_IDS.map((id) => id.length)) + 2;
const BUNDLE_LIST = BUNDLE_IDS.map(
  (id) => `                             ${id.padEnd(BUNDLE_WIDTH)}${PARTS[id].summary}`
).join("\n");

const USAGE = `Usage: valtimo-plugin-init [directory] [options]

Scaffolds a buildable Valtimo external plugin project.

  [directory]              Target directory (default '.'; the plugin id derives from its name)

  --plugin-id <id>         Plugin id; lowercase, alphanumeric at both ends
  --version <v>            Manifest and package version (default '${DEFAULT_VERSION}')
  --name <s>               Display name — translations.<locale>.name
  --description <s>        Description — translations.<locale>.description
  --provider <s>           Provider shown in GZAC (omitted when blank)
  --locales en,nl          Translation buckets to create (default 'en')

  --bundles <list>         Frontend bundle types, or 'all' / 'none'
                           (default '${DEFAULT_BUNDLES.join(",")}'). One of:
${BUNDLE_LIST}
  --with-config            Alias for --bundles config
  --with-case-tab          Alias for --bundles case-tab
  --with-event             Include an onEvent handler
  --minimal                No onEvent handler and no bundles (base only)

  --sdk <spec>             @valtimo/plugin-sdk dependency to write
                           (default '^<this SDK's version>', e.g. 'file:../../plugin-sdk')
  --yes, -y                Never prompt; take defaults for anything not supplied
  --no-install             Skip 'npm install' after generating
  --force                  Write into a non-empty directory
  --help, -h               Show this help

The onEvent handler is included by default and the bundle list defaults to '${DEFAULT_BUNDLES.join(",")}', which is
what the wizard offers, so --yes agrees with pressing Enter through it. Use --minimal to start from
the bare action, optionally re-adding parts (--minimal --bundles page).

Every bundle type is a peer: --bundles is a set, and the generated project is the same whatever
order it is written in.
`;

/** Retired flags, and the sentence that says what replaced them. */
const RETIRED_FLAGS = {
  "--with-frontend":
    "--with-frontend is retired: 'the frontend' no longer names one thing, now that all six bundle types are offered. Use --bundles <list>; see --help.",
};

const VALUE_FLAGS = {
  "--plugin-id": "pluginId",
  "--version": "version",
  "--name": "name",
  "--description": "description",
  "--provider": "provider",
  "--locales": "locales",
  "--bundles": "bundles",
  "--sdk": "sdkSpec",
};

/** Comma-separated flags, split into arrays before they reach resolveOptions. */
const LIST_FLAGS = new Set(["locales", "bundles"]);

function fail(message) {
  console.error(`${LOG_PREFIX} ${message}`);
  process.exit(1);
}

/** argv -> {raw, supplied, flags}. `supplied` is what the wizard must not ask about. */
function parseArgs(argv) {
  const raw = {};
  const supplied = new Set();
  const flags = {yes: false, install: true, force: false, help: false};
  const parts = {};
  // Accumulated rather than assigned, so --bundles page --with-config means both. Stays undefined
  // when nothing named a bundle, which is what lets the default apply.
  let bundles;
  let positional;

  const addBundles = (values) => {
    bundles = [...(bundles ?? []), ...values];
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const eq = arg.indexOf("=");
    const name = arg.startsWith("--") && eq > 0 ? arg.slice(0, eq) : arg;
    const inlineValue = arg.startsWith("--") && eq > 0 ? arg.slice(eq + 1) : undefined;

    if (name in RETIRED_FLAGS) fail(RETIRED_FLAGS[name]);

    if (name in VALUE_FLAGS) {
      const value = inlineValue ?? argv[++i];
      if (value === undefined) fail(`${name} needs a value.`);
      const key = VALUE_FLAGS[name];
      if (key === "bundles") {
        addBundles(value.split(","));
      } else {
        raw[key] = LIST_FLAGS.has(key) ? value.split(",") : value;
        supplied.add(key);
      }
      continue;
    }

    switch (name) {
      case "--help":
      case "-h":
        flags.help = true;
        break;
      case "--yes":
      case "-y":
        flags.yes = true;
        break;
      case "--no-install":
        flags.install = false;
        break;
      case "--force":
        flags.force = true;
        break;
      // Applied in a fixed order below, so --minimal --with-event means "just the event handler"
      // rather than depending on which was typed first.
      case "--minimal":
        parts.minimal = true;
        break;
      case "--with-event":
        parts.onEvent = true;
        break;
      // Kept as aliases because they are documented; --bundles is the flag that scales to six types.
      case "--with-config":
        addBundles(["config"]);
        break;
      case "--with-case-tab":
        addBundles(["case-tab"]);
        break;
      default:
        if (name.startsWith("-")) fail(`Unknown option ${name}. Try --help.`);
        if (positional !== undefined) fail(`Unexpected extra argument '${name}'. Try --help.`);
        positional = name;
    }
  }

  if (parts.minimal) {
    raw.onEvent = false;
    supplied.add("onEvent");
  }
  if (parts.onEvent) {
    raw.onEvent = true;
    supplied.add("onEvent");
  }
  if (parts.minimal || bundles !== undefined) {
    // --minimal contributes an *empty* list rather than leaving it absent, since absent means "take
    // the default". Anything named alongside it still counts, so --minimal --bundles page works.
    raw.bundles = bundles ?? [];
    supplied.add("bundles");
  }

  raw.targetDir = resolve(process.cwd(), positional ?? ".");
  return {raw, supplied, flags};
}

const {raw, supplied, flags} = parseArgs(process.argv.slice(2));

if (flags.help) {
  console.log(USAGE);
  process.exit(0);
}

// The SDK's own version is the default dependency range for the generated project, exactly like
// the pack tool reads it to stamp `sdkVersion` into a package.
const sdkVersion = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8")
).version;
const templatesDir = fileURLToPath(new URL("../templates", import.meta.url));

let options;
try {
  // --yes means "no prompting" even on a TTY: that is what makes CI and any wrapper script
  // deterministic. Without a TTY there is nobody to answer, so the same path is taken.
  const interactive = Boolean(process.stdin.isTTY) && !flags.yes;
  const input = interactive
    ? await runWizard({
        input: process.stdin,
        output: process.stdout,
        defaults: {
          ...raw,
          pluginId: raw.pluginId ?? pluginIdFromDirectoryName(raw.targetDir) ?? undefined,
          version: raw.version ?? DEFAULT_VERSION,
          description: raw.description ?? DEFAULT_DESCRIPTION,
        },
        supplied,
      })
    : raw;
  options = resolveOptions(input, {sdkVersion});
} catch (err) {
  if (err instanceof ScaffoldError) fail(err.message);
  throw err;
}

let result;
try {
  result = generatePlugin({options, templatesDir, force: flags.force});
} catch (err) {
  if (err instanceof ScaffoldError) fail(err.message);
  throw err;
}

// A `cd` the reader can copy: relative while it stays inside the working directory, absolute once
// it would start climbing out of it.
const relativeTarget = relative(process.cwd(), result.targetDir);
const shown =
  relativeTarget === ""
    ? "."
    : relativeTarget.startsWith("..")
      ? result.targetDir
      : relativeTarget;
console.log(`\n${LOG_PREFIX} Created ${shown}/ (${result.files.length} files)`);
for (const file of result.files) {
  console.log(`  ${file}`);
}

if (flags.install) {
  console.log(`\n${LOG_PREFIX} Installing dependencies ...`);
  // Windows: npm is a .cmd shim, which Node only executes through a shell.
  const install = spawnSync("npm", ["install"], {
    cwd: result.targetDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (install.error || install.status !== 0) {
    // Not fatal: the project on disk is complete and correct, and the install is re-runnable. The
    // usual cause is that @valtimo/plugin-sdk is not resolvable yet — see --sdk.
    console.warn(
      `\n${LOG_PREFIX} Warning: 'npm install' failed. The project was written; run 'npm install' in ${shown} yourself.`
    );
    console.warn(
      `${LOG_PREFIX} If @valtimo/plugin-sdk could not be resolved, re-run with --sdk <spec> (e.g. --sdk file:/path/to/plugin-sdk).`
    );
  }
}

console.log(`
Next steps:
  cd ${shown}${flags.install ? "" : "\n  npm install"}
  npm run build:pack     # -> dist/${options.pluginId}-${options.version}.zip

The first build downloads the Wasm toolchain (extism-js + binaryen), so it takes a while; later
builds are seconds. Then upload the package to a running plugin host — from a checkout of the
Valtimo plugin host, that is:
  npm run plugin:upload -- ${shown}/dist/${options.pluginId}-${options.version}.zip
`);
