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

import {CSP_META_ID} from '@valtimo/security';

/**
 * Whether the CSP meta tag the app bootstrapped with allows framing content from the given URL's
 * origin. The meta tag is immutable once parsed, so a host registered *after* bootstrap is not
 * covered until the page is reloaded — that is exactly what this check detects.
 *
 * Returns `true` when no CSP meta tag is present (no CSP configured → nothing blocks the iframe)
 * or when the URL cannot be parsed (nothing sensible to check; the iframe component itself refuses
 * unsafe URLs). The matcher intentionally covers only the source forms this app's CSP is built
 * from (exact origins, `*`, scheme-only and `*.domain` sources) — anything unrecognised counts as
 * "not allowed", which errs on the side of a harmless extra page refresh.
 */
function cspAllowsFrameOrigin(url: string, doc: Document = document): boolean {
  const cspMeta = doc.getElementById(CSP_META_ID) as HTMLMetaElement | null;
  if (!cspMeta?.content) return true;

  let origin: URL;
  try {
    origin = new URL(new URL(url).origin);
  } catch {
    return true;
  }

  const directives = new Map<string, string[]>();
  cspMeta.content.split(';').forEach(part => {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length > 0) directives.set(tokens[0].toLowerCase(), tokens.slice(1));
  });

  // frame-src falls back to child-src, then default-src (the CSP fallback chain).
  const sources =
    directives.get('frame-src') ?? directives.get('child-src') ?? directives.get('default-src');
  // A CSP without any of these directives does not restrict framing.
  if (!sources) return true;

  return sources.some(source => matchesSource(source, origin, doc));
}

function matchesSource(source: string, origin: URL, doc: Document): boolean {
  const normalized = source.trim().toLowerCase();

  if (normalized === '*') return true;
  if (normalized === "'self'") return origin.origin === new URL(doc.location.origin).origin;
  // Scheme-only sources ("https:") allow every origin with that scheme.
  if (/^[a-z][a-z0-9+.-]*:$/.test(normalized)) return origin.protocol === normalized;

  // Host sources, with optional scheme and wildcard subdomain: [scheme://]host[:port]
  const match = normalized.match(/^(?:([a-z][a-z0-9+.-]*):\/\/)?([^/]+)$/);
  if (!match) return false;

  const [, scheme, hostAndPort] = match;
  if (scheme && `${scheme}:` !== origin.protocol) return false;

  const originHostAndPort = origin.host.toLowerCase();
  if (hostAndPort.startsWith('*.')) {
    return originHostAndPort.endsWith(hostAndPort.slice(1));
  }
  // Without an explicit port, a host source matches the scheme's default port as well.
  return originHostAndPort === hostAndPort || origin.hostname.toLowerCase() === hostAndPort;
}

export {cspAllowsFrameOrigin};
