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

import {createHash} from "node:crypto";

/**
 * Remote introspection of GZAC-minted downscoped user tokens.
 *
 * The host cannot validate the HS256 user token locally — the signing key never leaves GZAC — so
 * the /data route validates it by calling GZAC's introspection endpoint
 * (`GET /api/v1/external-plugin/user-token/introspect`) *with the token itself* as the bearer
 * credential. GZAC's user-token filter authenticates it and the resource echoes the token's own
 * claims back: `{ subject, configurationId, expiresAt }`.
 *
 * Outcomes are deliberately trichotomous so the route can fail closed:
 * - `valid` — GZAC accepted the token; carries the configuration id the token is bound to.
 * - `invalid` — GZAC rejected it (401/403): expired, forged, or not a user token.
 * - `unavailable` — GZAC was unreachable, timed out, or answered unusably. The token's validity is
 *   UNKNOWN; the route must respond 503 and never execute Wasm on an unvalidated token.
 *
 * Positive results are cached in-memory, keyed by a SHA-256 hash of the token (the raw token is
 * never used as a map key), valid until `min(token expiresAt, now + CACHE_TTL_MS)` — so repeated
 * /data calls with the same token cost one GZAC round-trip per minute at most. Negative results
 * are not cached: rejections are cheap for GZAC and caching them could lock out a freshly minted
 * token. Expired entries are evicted lazily on lookup, like the route's rate-limit window map.
 */

export type IntrospectionOutcome =
  | { kind: "valid"; configurationId: string }
  | { kind: "invalid" }
  | { kind: "unavailable" };

const DEFAULT_TIMEOUT_MS = 10_000;
/** Upper bound on how long a positive introspection is reused without re-asking GZAC. */
const CACHE_TTL_MS = 60_000;

export class UserTokenIntrospector {
  private readonly timeoutMs: number;
  private readonly cache = new Map<string, { configurationId: string; validUntilMs: number }>();

  constructor(options: { timeoutMs?: number } = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async introspect(gzacBaseUrl: string, userToken: string): Promise<IntrospectionOutcome> {
    const key = createHash("sha256").update(userToken, "utf8").digest("hex");
    const now = Date.now();

    const cached = this.cache.get(key);
    if (cached) {
      if (cached.validUntilMs > now) {
        return { kind: "valid", configurationId: cached.configurationId };
      }
      // Lazy eviction: a stale entry is dropped when (and only when) its token shows up again.
      this.cache.delete(key);
    }

    const url = `${gzacBaseUrl.replace(/\/$/, "")}/api/v1/external-plugin/user-token/introspect`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      // Timeout, DNS failure, connection refused, … — GZAC didn't answer the question.
      return { kind: "unavailable" };
    }

    if (res.status === 401 || res.status === 403) {
      return { kind: "invalid" };
    }
    if (res.status !== 200) {
      // 5xx / unexpected status: not a verdict on the token — treat as unavailable (fail closed).
      return { kind: "unavailable" };
    }

    let body: { configurationId?: unknown; expiresAt?: unknown };
    try {
      body = (await res.json()) as never;
    } catch {
      return { kind: "unavailable" };
    }
    if (typeof body?.configurationId !== "string" || typeof body?.expiresAt !== "string") {
      return { kind: "unavailable" };
    }
    const expiresAtMs = Date.parse(body.expiresAt);
    if (Number.isNaN(expiresAtMs)) {
      return { kind: "unavailable" };
    }

    const validUntilMs = Math.min(expiresAtMs, now + CACHE_TTL_MS);
    if (validUntilMs > now) {
      this.cache.set(key, { configurationId: body.configurationId, validUntilMs });
    }
    return { kind: "valid", configurationId: body.configurationId };
  }
}
