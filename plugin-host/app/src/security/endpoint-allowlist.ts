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

import type { Endpoint } from "../models/index.js";

/**
 * Ant-style endpoint pattern matching for the `gzac_api` allowlist, mirroring the backend's
 * `ExternalPluginEndpointAllowlistFilter` (Spring `AntPathMatcher`) semantics for the subset the
 * manifest uses:
 *
 * - `*`  matches any number of characters **within** one path segment (never a `/`);
 * - `**` matches any number of characters **across** segments (including none);
 * - a trailing `/**` also matches the bare prefix path itself (`/api/x/**` matches `/api/x`).
 *
 * Both sides enforce the same list: GZAC's servlet filter is the authoritative gate, this module
 * lets the host refuse a non-granted callback before it ever leaves the sidecar.
 */

const REGEX_SPECIALS = /[.+?^${}()|[\]\\]/g;

/** Compiles one Ant-style pattern to an anchored RegExp. */
export function antPatternToRegExp(pattern: string): RegExp {
  // A trailing "/**" matches the prefix itself too (Ant semantics), so peel it off first.
  let suffix = "";
  let base = pattern;
  if (base.endsWith("/**")) {
    base = base.slice(0, -3);
    suffix = "(/.*)?";
  }
  const source = base
    .split("**")
    .map((part) => part.replace(REGEX_SPECIALS, "\\$&").replaceAll("*", "[^/]*"))
    .join(".*");
  return new RegExp(`^${source}${suffix}$`);
}

/** True when `method` + `path` (query string ignored) matches at least one granted endpoint. */
export function isEndpointAllowed(
  method: string,
  path: string,
  endpoints: Endpoint[]
): boolean {
  const normalizedMethod = method.toUpperCase();
  const normalizedPath = path.split("?")[0];
  return endpoints.some(
    (endpoint) =>
      (endpoint.method === "*" || endpoint.method.toUpperCase() === normalizedMethod) &&
      antPatternToRegExp(endpoint.pattern).test(normalizedPath)
  );
}
