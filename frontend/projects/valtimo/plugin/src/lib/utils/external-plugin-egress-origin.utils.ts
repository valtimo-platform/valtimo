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
 * Canonical `scheme://host:port` of an `x-egress-target` value, or null when GZAC would refuse it:
 * not http(s), no host, or carrying credentials. Mirrors `PluginEgressTargets.normalizeOrigin`.
 */
function normalizeExternalPluginEgressOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const port = url.port || DEFAULT_PORTS[url.protocol];
  if (port === undefined || url.hostname === '' || url.username || url.password) return null;
  return `${url.protocol}//${url.hostname}:${port}`;
}

export {normalizeExternalPluginEgressOrigin};
