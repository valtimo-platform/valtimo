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

import type { GzacInstanceRepository } from "./db/gzac-instance-repository.js";

/**
 * Canonicalises one browser origin to `scheme://host[:port]`, or returns null when the value is not
 * a bare http(s) origin. Mirrors GZAC's own normalization so both sides agree on what is stored and
 * what a `frame-policy` probe compares against.
 *
 * A wildcard is rejected rather than passed through: an allowlist entry that matches any page is
 * exactly what a `frame-ancestors` policy exists to prevent.
 */
export function normalizeOrigin(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\/+$/, "");
  if (trimmed.length === 0 || trimmed.includes("*")) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  // `new URL("https://example.com")` normalises the path to "/", so only a longer path is a real one.
  if (url.pathname !== "/" && url.pathname !== "") return null;
  if (url.search || url.hash) return null;
  return url.port ? `${url.protocol}//${url.hostname}:${url.port}` : `${url.protocol}//${url.hostname}`;
}

/** Normalizes a list of origins, dropping every entry that is not a bare http(s) origin. */
export function normalizeOrigins(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const normalized = values.map(normalizeOrigin).filter((o): o is string => o !== null);
  return [...new Set(normalized)];
}

/**
 * The browser origins allowed to frame this host's plugin content.
 *
 * Two sources, unioned: the origins GZAC instances announce (persisted, so they survive a restart)
 * and `ALLOWED_FRAME_ANCESTORS` from the environment (the operator's escape hatch for local
 * development and for frontends no GZAC registers). An instance that stops announcing is ignored
 * after `staleMs` — there is no deregistration call, so ageing out is what removes a decommissioned
 * GZAC from the allowlist.
 *
 * Reads are served from a short-TTL in-memory cache because this sits on the bundle hot path; the
 * trade-off matches `ConfigRegistry`'s (a write by ANOTHER replica becomes visible after at most the
 * TTL). Writes through this registry invalidate immediately.
 */
export class FrameAncestorRegistry {
  private cache: { origins: string[]; expiresAt: number } | null = null;
  private readonly staticOrigins: string[];

  constructor(
    private readonly repo: GzacInstanceRepository,
    staticOrigins: string[] = [],
    private readonly staleMs: number = 7 * 24 * 60 * 60 * 1000,
    private readonly cacheTtlMs: number = 10_000
  ) {
    this.staticOrigins = normalizeOrigins(staticOrigins);
  }

  /** Records (or refreshes) one GZAC instance's origins. Invalidates the cache immediately. */
  async register(gzacBaseUrl: string, frontendOrigins: string[]): Promise<void> {
    await this.repo.upsert(gzacBaseUrl, normalizeOrigins(frontendOrigins));
    this.invalidate();
  }

  /** Every origin currently allowed to frame plugin content. Empty means nothing may frame it. */
  async allowedOrigins(): Promise<string[]> {
    if (this.cacheTtlMs > 0 && this.cache && this.cache.expiresAt > Date.now()) {
      return this.cache.origins;
    }
    const instances = await this.repo.listFresh(this.staleMs);
    const origins = [
      ...new Set([...instances.flatMap((instance) => instance.frontendOrigins), ...this.staticOrigins]),
    ];
    if (this.cacheTtlMs > 0) {
      this.cache = { origins, expiresAt: Date.now() + this.cacheTtlMs };
    }
    return origins;
  }

  /** Whether one specific origin may frame plugin content. Backs the `frame-policy` probe. */
  async isAllowed(origin: string): Promise<boolean> {
    const normalized = normalizeOrigin(origin);
    if (normalized === null) return false;
    return (await this.allowedOrigins()).includes(normalized);
  }

  /** Drops the cached allowlist. Called after every write through this registry. */
  invalidate(): void {
    this.cache = null;
  }
}

/** The subset of the registry the bundle routes need, so tests can stand in a plain object. */
export interface FrameAncestorSource {
  allowedOrigins(): Promise<string[]>;
  isAllowed(origin: string): Promise<boolean>;
}
