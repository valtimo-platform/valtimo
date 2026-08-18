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
 * Minimal HMAC-signed client for the Plugin Host admin API, mirroring the scheme implemented in
 * app/src/security/hmac.ts (and GZAC's ExternalPluginHmacSigner):
 *
 *   signature = HMAC-SHA256(ADMIN_TOKEN, "{METHOD}\n{path}\n{timestamp}\n{sha256hex(body)}")
 *
 * sent as `X-Valtimo-Signature` + `X-Valtimo-Timestamp`. The path excludes the query string. The
 * multipart plugin upload signs the raw .zip file bytes, not the multipart envelope. GET requests
 * bind an empty body.
 *
 * Used by the bootstrap scripts to upload the sample plugin — a portable replacement for the
 * bash/openssl snippet that only worked on unix shells.
 */

import {createHash, createHmac} from "node:crypto";
import {readFile} from "node:fs/promises";
import {basename} from "node:path";

export function signRequest(token, method, path, body = Buffer.alloc(0)) {
  const timestamp = new Date().toISOString();
  const bodyHash = createHash("sha256").update(body).digest("hex");
  const payload = `${method.toUpperCase()}\n${path}\n${timestamp}\n${bodyHash}`;
  const signature = createHmac("sha256", token).update(payload, "utf8").digest("hex");
  return {
    "X-Valtimo-Timestamp": timestamp,
    "X-Valtimo-Signature": signature,
  };
}

async function parseBody(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** GET /health — returns true when the host answers. */
export async function isHealthy(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

/** Polls /health until the host is up or the timeout elapses. */
export async function waitForHealth(baseUrl, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isHealthy(baseUrl)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Plugin host did not become healthy at ${baseUrl}/health within ${timeoutMs / 1000}s`);
}

/** GET /api/host/plugins — lists stored plugins. */
export async function listPlugins(baseUrl, token) {
  const path = "/api/host/plugins";
  const res = await fetch(`${baseUrl}${path}`, {
    headers: signRequest(token, "GET", path),
  });
  if (!res.ok) {
    throw new Error(`Listing plugins failed: HTTP ${res.status} — ${JSON.stringify(await parseBody(res))}`);
  }
  return res.json();
}

/**
 * POST /api/host/plugins — uploads a plugin .zip. The signature binds the file bytes.
 *
 * Returns `{status: "uploaded"|"unchanged", ...}`. When the version already exists with identical
 * content the upload is treated as a no-op; when the content differs it is retried with
 * `?overwrite=true` only if `overwrite` is set.
 */
export async function uploadPlugin(baseUrl, token, zipPath, {overwrite = false} = {}) {
  const bytes = await readFile(zipPath);
  const path = "/api/host/plugins";

  const attempt = async (withOverwrite) => {
    const form = new FormData();
    form.append("file", new Blob([bytes], {type: "application/zip"}), basename(zipPath));
    const query = withOverwrite ? "?overwrite=true" : "";
    return fetch(`${baseUrl}${path}${query}`, {
      method: "POST",
      headers: signRequest(token, "POST", path, bytes),
      body: form,
    });
  };

  let res = await attempt(false);
  if (res.status === 409) {
    const conflict = await parseBody(res);
    if (conflict.currentContentHash && conflict.currentContentHash === conflict.uploadedContentHash) {
      return {status: "unchanged", detail: conflict};
    }
    if (!overwrite) {
      throw new Error(
        `Plugin version already exists on the host with different content. ` +
          `Re-run with --overwrite to replace it. (${JSON.stringify(conflict)})`
      );
    }
    res = await attempt(true);
  }
  if (!res.ok) {
    throw new Error(`Upload failed: HTTP ${res.status} — ${JSON.stringify(await parseBody(res))}`);
  }
  const detail = await parseBody(res);
  return {
    status: "uploaded",
    pluginId: detail.pluginId,
    version: detail.version,
    contentHash: detail.contentHash,
    detail,
  };
}
