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
 * Dev launcher: starts the PostgreSQL container and runs the host with auto-reload. A script
 * (rather than `ADMIN_TOKEN=... tsx watch` inline in package.json) so it also works on Windows,
 * where inline env assignments and unix PATH handling are unavailable.
 */

import {spawn, spawnSync} from "node:child_process";
import {delimiter, dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";

const db = spawnSync("docker", ["compose", "up", "-d", "db"], {cwd: appDir, stdio: "inherit"});
if (db.error || db.status !== 0) {
  console.error("Failed to start PostgreSQL via docker compose. Is Docker running?");
  process.exit(1);
}

const env = {
  ...process.env,
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || "test-secret",
  PATH: `${join(appDir, "node_modules", ".bin")}${delimiter}${process.env.PATH ?? ""}`,
};

// tsx is a .cmd shim on Windows, which Node only executes through a shell.
const child = spawn("tsx", ["watch", "src/index.ts"], {
  cwd: appDir,
  env,
  stdio: "inherit",
  shell: isWindows,
});
child.on("exit", (code) => process.exit(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill());
}
