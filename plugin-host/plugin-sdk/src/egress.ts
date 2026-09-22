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
 * Normalisation and matching for the `http_request` egress allowlist.
 *
 * `http_request` is deny-by-default: the host only calls destinations the admin accepted, drawn from
 * two sources GZAC unions before pushing them — `manifest.permissions.egress` (fixed targets the
 * plugin author knows at build time) and configuration properties marked `x-egress-target` (the
 * environment-specific ones only the admin knows). This mirrors the `connect-src 'self'` policy the
 * plugin's iframe half already runs under, so a compromised dependency cannot phone home from the
 * Wasm half either.
 *
 * The same rules have to hold in three places — the manifest validator (build-time and upload-time
 * gate), the host's runtime check, and GZAC's activation-time validation — so a target that passes
 * review is exactly the target permitted at runtime. This module is the single definition for the
 * two halves written in TypeScript; GZAC mirrors it in Kotlin.
 *
 * An entry denotes an **origin**, not a hostname:
 *
 * - `api.kvk.nl` normalises to `https://api.kvk.nl:443`. Matching on origin rather than hostname is
 *   what stops an `http://` downgrade slipping through when `HOST_ALLOW_HTTP=true`.
 * - An absent port means *the scheme's default port*, never "any port" — otherwise `sd.internal`
 *   would silently authorise `sd.internal:9200`.
 * - A leading `*.` wildcard matches exactly **one** non-empty label (`a.vendor.com`, not
 *   `a.b.vendor.com` and not the bare `vendor.com`), and requires at least two labels after it so
 *   `*.com` is impossible. Wildcards widen the grant considerably — `*.vendor.com` under
 *   author-controlled DNS reopens both arbitrary-subdomain exfiltration and the DNS channel, since
 *   `<encoded-data>.vendor.com` then passes — so they belong only in a manifest, where an admin sees
 *   them on the acceptance screen.
 */

/** Schemes an egress entry may name, with the port assumed when the entry omits one. */
const DEFAULT_PORTS: Record<string, string> = {
  "http:": "80",
  "https:": "443",
};

/** `scheme://` prefix. Deliberately requires the `//`: `sd.internal:8443` is a host:port, not a scheme. */
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/** A parsed egress entry — an origin, with the port always resolved to an explicit value. */
export interface EgressOrigin {
  /** Lower-case scheme including the trailing colon, e.g. `https:`. */
  protocol: string;
  /** Lower-case host. Keeps the `*.` prefix for a wildcard entry. */
  hostname: string;
  /** Explicit port, or the scheme's default when the entry omitted one. Never empty. */
  port: string;
  /** True when {@link hostname} starts with `*.`. */
  wildcard: boolean;
}

/**
 * Parses one allowlist entry into an origin, or returns null when it is not a usable one. Use
 * {@link validateEgressEntry} when you need to tell the author *why* an entry was rejected.
 */
export function parseEgressEntry(raw: unknown): EgressOrigin | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  // A scheme-less entry is an https origin — the safe default, since adding http:// is an explicit
  // downgrade the author has to write out.
  let url: URL;
  try {
    url = new URL(HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const port = url.port || DEFAULT_PORTS[url.protocol];
  if (port === undefined) return null;
  if (url.username !== "" || url.password !== "") return null;
  // An entry is an origin, so anything narrowing it (a path) or carrying data (query/fragment) is a
  // misunderstanding of what the grant covers rather than something to silently ignore.
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") return null;
  if (!isAllowedEgressHost(url.hostname)) return null;

  return {
    protocol: url.protocol,
    hostname: url.hostname,
    port,
    wildcard: url.hostname.startsWith("*."),
  };
}

/**
 * The canonical `scheme://host:port` string for an entry, or null when it is not usable. Two entries
 * that authorise the same destination always produce the same key, so callers can dedupe on it.
 */
export function normalizeEgressEntry(raw: unknown): string | null {
  const origin = parseEgressEntry(raw);
  return origin === null ? null : `${origin.protocol}//${origin.hostname}:${origin.port}`;
}

/**
 * A human-readable reason why `raw` is not a usable egress entry, or null when it is fine. Kept
 * separate from {@link parseEgressEntry} so the manifest validator can be specific while the
 * runtime check stays a cheap predicate.
 */
export function validateEgressEntry(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.trim() === "") {
    return "must be a non-empty string";
  }
  const trimmed = raw.trim();
  const scheme = HAS_SCHEME.test(trimmed) ? trimmed.slice(0, trimmed.indexOf(":") + 1).toLowerCase() : null;
  if (scheme !== null && DEFAULT_PORTS[scheme] === undefined) {
    return `must use http:// or https://, not '${scheme}//'`;
  }

  let url: URL;
  try {
    url = new URL(scheme !== null ? trimmed : `https://${trimmed}`);
  } catch {
    return `'${trimmed}' is not a parseable origin (expected e.g. 'api.example.com' or 'https://svc.internal:8443')`;
  }
  if (url.username !== "" || url.password !== "") {
    return "must not carry credentials — an egress entry is an origin (scheme, host and port) only";
  }
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") {
    return "must be an origin without a path, query or fragment — the grant covers the whole origin";
  }
  return hostRejectionReason(url.hostname);
}

/**
 * True when `url` is authorised by at least one entry. An empty or absent list denies everything:
 * `http_request` is deny-by-default, so a configuration with no declared egress makes no outbound
 * calls at all.
 */
export function isEgressAllowed(url: URL, entries: readonly string[] | undefined): boolean {
  if (entries === undefined || entries.length === 0) return false;
  return entries.some((entry) => {
    const origin = parseEgressEntry(entry);
    return origin !== null && egressOriginMatches(origin, url);
  });
}

/** True when `url`'s scheme, host and port are all authorised by `origin`. */
export function egressOriginMatches(origin: EgressOrigin, url: URL): boolean {
  if (url.protocol !== origin.protocol) return false;
  const urlPort = url.port || DEFAULT_PORTS[url.protocol];
  if (urlPort !== origin.port) return false;
  return hostMatches(origin, url.hostname.toLowerCase());
}

function hostMatches(origin: EgressOrigin, hostname: string): boolean {
  if (!origin.wildcard) return hostname === origin.hostname;
  // `*.vendor.com` covers exactly one extra label: the matched prefix must be non-empty and contain
  // no dot of its own, so neither `vendor.com` nor `a.b.vendor.com` is authorised.
  const suffix = origin.hostname.slice(1); // ".vendor.com"
  if (!hostname.endsWith(suffix)) return false;
  const label = hostname.slice(0, -suffix.length);
  return label.length > 0 && !label.includes(".");
}

/** Host syntax an entry may use. Mirrors {@link hostRejectionReason}, which explains the failures. */
function isAllowedEgressHost(hostname: string): boolean {
  return hostRejectionReason(hostname) === null;
}

function hostRejectionReason(hostname: string): string | null {
  if (hostname === "") return "must name a host";
  if (hostname.startsWith("*.")) {
    const suffix = hostname.slice(2);
    if (suffix.includes("*")) {
      return "may only use a wildcard as the leading '*.' label";
    }
    // `*.com` (or `*.internal`) would hand over a whole TLD, so require a real domain beneath it.
    if (suffix.split(".").filter((label) => label !== "").length < 2) {
      return `'${hostname}' is too broad — a '*.' wildcard needs at least two labels after it (e.g. '*.vendor.com')`;
    }
    return null;
  }
  if (hostname.includes("*")) {
    return "may only use a wildcard as the leading '*.' label";
  }
  return null;
}