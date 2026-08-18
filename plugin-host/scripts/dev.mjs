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
 * Checkout → running host in one command:
 *
 *   npm run dev                # from plugin-host/
 *   npm run dev -- --no-sample # skip the sample-plugin upload
 *
 * What it does:
 *   1. Runs setup first when the checkout hasn't been bootstrapped yet (see setup.mjs)
 *   2. Starts PostgreSQL (docker compose, from app/)
 *   3. Starts the plugin host with auto-reload (tsx watch)
 *   4. Waits for /health, then uploads the built sample plugin over the signed admin API
 *
 * Environment: ADMIN_TOKEN (default `test-secret` — dev only), PORT (default 8090).
 */

import {join} from "node:path";
import {
  APP_DIR,
  checkNodeVersion,
  dockerIsRunning,
  envWithPath,
  fail,
  info,
  note,
  run,
  spawnLongRunning,
  step,
} from "./lib/common.mjs";
import {isHealthy, listPlugins, uploadPlugin} from "./lib/host-client.mjs";
import {needsSetup, runSetup, samplePluginZipPath} from "./setup.mjs";

checkNodeVersion();

const uploadSample = !process.argv.includes("--no-sample");
const adminToken = process.env.ADMIN_TOKEN || "test-secret";
const port = process.env.PORT || "8090";
const baseUrl = process.env.PLUGIN_HOST_URL || `http://localhost:${port}`;

if (needsSetup()) {
  step("First run detected — bootstrapping (npm run setup)");
  await runSetup();
}

step("PostgreSQL — docker compose up");
if (!dockerIsRunning()) {
  fail(
    "Docker is not running. The plugin host stores plugins and configurations in PostgreSQL,\n" +
      "  which is started via docker compose. Start Docker Desktop (or the docker daemon) and retry."
  );
}
run("docker", ["compose", "up", "-d", "db"], {cwd: APP_DIR});

step(`Plugin host — starting on ${baseUrl} (auto-reload)`);
if (adminToken === "test-secret") {
  note("ADMIN_TOKEN not set — using the dev default 'test-secret'.");
}
const child = spawnLongRunning("tsx", ["watch", "src/index.ts"], {
  cwd: APP_DIR,
  env: envWithPath([join(APP_DIR, "node_modules", ".bin")], {
    ...process.env,
    ADMIN_TOKEN: adminToken,
  }),
});

let childExited = false;
child.on("exit", (code) => {
  childExited = true;
  process.exit(code ?? 1);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill();
  });
}

// Wait for /health, bailing out if the host process died during startup.
const deadline = Date.now() + 90_000;
let healthy = false;
while (Date.now() < deadline && !childExited) {
  if (await isHealthy(baseUrl)) {
    healthy = true;
    break;
  }
  await new Promise((r) => setTimeout(r, 500));
}
if (!healthy) {
  if (!childExited) child.kill();
  fail(`Plugin host did not report healthy at ${baseUrl}/health within 90s.`);
}

if (uploadSample) {
  step("Sample plugin — uploading to the host");
  try {
    // Overwrite is safe here: this replaces the local sample with its own rebuilt content.
    const result = await uploadPlugin(baseUrl, adminToken, samplePluginZipPath(), {overwrite: true});
    if (result.status === "unchanged") {
      info("Already on the host with identical content — nothing to do.");
    } else {
      info(`Uploaded ${result.pluginId}@${result.version} (${result.contentHash})`);
    }
    const plugins = await listPlugins(baseUrl, adminToken);
    info(`Plugins on host: ${plugins.map((p) => `${p.pluginId}@${p.version}`).join(", ")}`);
  } catch (err) {
    // The host keeps running — a failed sample upload shouldn't kill the dev loop.
    info(`Sample plugin upload failed: ${err.message}`);
  }
}

step("Ready");
info(`Plugin host:  ${baseUrl}  (health: ${baseUrl}/health)`);
info(`Admin token:  ${adminToken}`);
info(`Upload more:  npm run plugin:upload -- path/to/plugin.zip`);
info("Stop with Ctrl+C (PostgreSQL keeps running; 'npm run db:down' stops it).");
