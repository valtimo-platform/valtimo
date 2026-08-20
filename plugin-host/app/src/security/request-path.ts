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

import {posix} from "node:path";

export type NormalizedPath = { ok: true; path: string } | { ok: false; reason: string };

/** Percent-encoded `.`, `/` and `\` — the forms used to smuggle a traversal past a raw string check. */
const ENCODED_SEPARATORS = /%2e|%2f|%5c/i;

/**
 * Canonicalises a plugin-supplied GZAC API path so the string the allowlist is checked against is
 * the string that is actually requested. `fetch` resolves dot segments while parsing the URL, so
 * checking the raw path would let `/api/v1/document/../../../v1/case/1` match a grant on
 * `/api/v1/document/**` and then request `/v1/case/1`.
 *
 * Percent-encoded separators and dot segments (`%2e`, `%2f`, `%5c`) are refused rather than
 * decoded: deciding how many decode passes to apply is exactly the ambiguity that produces
 * bypasses, GZAC's servlet firewall rejects them anyway, and no legitimate call needs them.
 *
 * The query/fragment suffix is split off and preserved verbatim — it is not a path, so normalising
 * it would corrupt legitimate parameter values that happen to contain `//` or `..`.
 */
export function normalizeGzacApiPath(rawPath: unknown): NormalizedPath {
  if (typeof rawPath !== "string" || rawPath === "") {
    return { ok: false, reason: "'path' must be a non-empty string in gzac_api request" };
  }
  if (!rawPath.startsWith("/")) {
    return { ok: false, reason: "'path' must start with '/' in gzac_api request" };
  }

  const suffixStart = firstIndexOfAny(rawPath, ["?", "#"]);
  const pathPart = suffixStart === -1 ? rawPath : rawPath.slice(0, suffixStart);
  const suffix = suffixStart === -1 ? "" : rawPath.slice(suffixStart);

  if (pathPart.includes("\\")) {
    return { ok: false, reason: `'path' must not contain a backslash: ${pathPart}` };
  }
  if (ENCODED_SEPARATORS.test(pathPart)) {
    return {
      ok: false,
      reason: `'path' must not contain percent-encoded path separators or dot segments: ${pathPart}`,
    };
  }

  // Both `posix.normalize` and the WHATWG URL parser silently clamp a `..` that would pop above the
  // root (`/../x` → `/x`). Refuse those instead: a path asking to leave the API root is malformed,
  // and clamping it would turn a nonsense request into a valid-looking one.
  if (traversesAboveRoot(pathPart)) {
    return { ok: false, reason: `'path' escapes the API root: ${pathPart}` };
  }

  // Collapses `.` and `..` segments and duplicate slashes while keeping a trailing slash, which is
  // exactly what `fetch` does when it parses the URL.
  const normalized = posix.normalize(pathPart);
  if (!normalized.startsWith("/")) {
    return { ok: false, reason: `'path' escapes the API root: ${pathPart}` };
  }

  return { ok: true, path: normalized + suffix };
}

function traversesAboveRoot(pathPart: string): boolean {
  let depth = 0;
  for (const segment of pathPart.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      depth--;
      if (depth < 0) return true;
    } else {
      depth++;
    }
  }
  return false;
}

function firstIndexOfAny(value: string, needles: string[]): number {
  let found = -1;
  for (const needle of needles) {
    const index = value.indexOf(needle);
    if (index !== -1 && (found === -1 || index < found)) found = index;
  }
  return found;
}
