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

const DEFAULT_PORTS: Record<string, string> = {'http:': '80', 'https:': '443'};

/**
 * Preview of the `http_request` destinations GZAC will derive from a configuration's own values —
 * the origins of the properties the plugin marked `x-egress-target: true` in its
 * `configurationSchema`.
 *
 * Display only. GZAC recomputes this server-side on every push (`PluginEgressTargets`) and that
 * result is what the plugin host enforces; this exists so the permissions step can show the admin
 * the destinations their own input just authorised, alongside the manifest-declared ones. Kept in
 * step with the server by normalising the same way: scheme + host + port, with an absent port
 * meaning the scheme's default.
 *
 * Only top-level properties are inspected, matching the server-side walkers for `x-secret` and
 * `x-egress-target`.
 */
export function deriveExternalPluginEgressOrigins(
  configurationSchema: unknown,
  properties: Record<string, unknown> | null | undefined
): Array<string> {
  const origins = new Set<string>();
  for (const field of egressTargetFieldNames(configurationSchema)) {
    const value = properties?.[field];
    if (typeof value !== 'string') continue;
    const origin = normalizeEgressOrigin(value);
    if (origin !== null) origins.add(origin);
  }
  return [...origins];
}

function egressTargetFieldNames(configurationSchema: unknown): Array<string> {
  if (typeof configurationSchema !== 'object' || configurationSchema === null) return [];
  const schemaProperties = (configurationSchema as Record<string, unknown>)['properties'];
  if (typeof schemaProperties !== 'object' || schemaProperties === null) return [];
  return Object.entries(schemaProperties as Record<string, unknown>)
    .filter(
      ([, fieldSchema]) =>
        typeof fieldSchema === 'object' &&
        fieldSchema !== null &&
        (fieldSchema as Record<string, unknown>)['x-egress-target'] === true
    )
    .map(([field]) => field);
}

/** Canonical `scheme://host:port`, or null when the value is not an absolute http(s) URL. */
function normalizeEgressOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  const port = url.port || DEFAULT_PORTS[url.protocol];
  if (port === undefined || url.hostname === '') return null;
  return `${url.protocol}//${url.hostname}:${port}`;
}
