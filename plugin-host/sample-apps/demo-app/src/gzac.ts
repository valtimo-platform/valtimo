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

/** Result of a call back into GZAC: the HTTP status and the parsed body (or raw text). */
export interface GzacResult<T = unknown> {
  status: number;
  body: T | null;
}

/**
 * Calls back into GZAC with a bearer token. The token is either the per-configuration **service
 * token** (system principal, PBAC bypassed, allowlist-enforced) or a **downscoped user token**
 * (the logged-in user, PBAC ∩ allowlist). Either way GZAC enforces that the `{method, path}` is in
 * the configuration's granted-endpoint allowlist; an ungranted call comes back as 403.
 *
 * This is the app's equivalent of the plugin host's `gzac_api` host function — the app receives the
 * tokens in the config push (service) or the `/data` request body (user) and never exposes them to
 * the browser.
 */
export async function callGzac<T = unknown>(
  gzacBaseUrl: string,
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<GzacResult<T>> {
  const url = gzacBaseUrl.replace(/\/$/, "") + path;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
  let payload: string | undefined;
  if (body !== undefined && body !== null) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(url, { method: method.toUpperCase(), headers, body: payload });
  const text = await res.text();
  let parsed: T | null = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as T;
    } catch {
      parsed = text as unknown as T;
    }
  }
  return { status: res.status, body: parsed };
}
