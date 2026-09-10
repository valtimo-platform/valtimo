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
 * Uploads a plugin .zip to a running plugin host over the HMAC-signed admin API. Works on any OS —
 * no openssl/bash required.
 *
 *   npm run plugin:upload                                  # uploads the built sample plugin
 *   npm run plugin:upload -- path/to/plugin.zip            # uploads a specific package
 *   npm run plugin:upload -- path/to/plugin.zip --overwrite
 *
 * Environment: ADMIN_TOKEN (default `test-secret`), PLUGIN_HOST_URL (default http://localhost:8090).
 */

import {existsSync} from "node:fs";
import {resolve} from "node:path";
import {checkNodeVersion, fail, info, step} from "./lib/common.mjs";
import {isHealthy, listPlugins, uploadPlugin} from "./lib/host-client.mjs";
import {samplePluginZipPath} from "./setup.mjs";

checkNodeVersion();

const args = process.argv.slice(2);
const overwrite = args.includes("--overwrite");
const positional = args.filter((a) => !a.startsWith("--"));

const zipPath = positional[0] ? resolve(positional[0]) : samplePluginZipPath();
const adminToken = process.env.ADMIN_TOKEN || "test-secret";
const baseUrl = process.env.PLUGIN_HOST_URL || `http://localhost:${process.env.PORT || "8090"}`;

if (!existsSync(zipPath)) {
  fail(
    `Plugin package not found: ${zipPath}\n` +
      "  Build it first — for the sample plugin run 'npm run sample:build' (or 'npm run setup')."
  );
}
if (!(await isHealthy(baseUrl))) {
  fail(`No plugin host responding at ${baseUrl} — start it with 'npm run dev'.`);
}

step(`Uploading ${zipPath} to ${baseUrl}`);
try {
  const result = await uploadPlugin(baseUrl, adminToken, zipPath, {overwrite});
  if (result.status === "unchanged") {
    info("Already on the host with identical content — nothing to do.");
  } else {
    info(`Uploaded ${result.pluginId}@${result.version} (${result.contentHash})`);
  }
  const plugins = await listPlugins(baseUrl, adminToken);
  info(`Plugins on host: ${plugins.map((p) => `${p.pluginId}@${p.version}`).join(", ")}`);
} catch (err) {
  fail(err.message);
}
