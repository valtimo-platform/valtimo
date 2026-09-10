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
 * Dev launcher: builds the iframe bundles, then runs the app with auto-reload. A script (rather
 * than `ADMIN_TOKEN=... tsx watch` inline in package.json) so it also works on Windows.
 */

import {spawn, spawnSync} from "node:child_process";
import {delimiter, dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";

const build = spawnSync(
  process.execPath,
  [join(projectRoot, "scripts", "build-frontend.mjs")],
  {cwd: projectRoot, stdio: "inherit"}
);
if (build.status !== 0) process.exit(build.status ?? 1);

const env = {
  ...process.env,
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || "test-secret",
  PATH: `${join(projectRoot, "node_modules", ".bin")}${delimiter}${process.env.PATH ?? ""}`,
};

// tsx is a .cmd shim on Windows, which Node only executes through a shell.
const child = spawn("tsx", ["watch", "src/index.ts"], {
  cwd: projectRoot,
  env,
  stdio: "inherit",
  shell: isWindows,
});
child.on("exit", (code) => process.exit(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill());
}
