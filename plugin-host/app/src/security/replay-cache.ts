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
 * In-memory seen-signature cache backing HMAC replay rejection.
 *
 * The timestamp drift check alone leaves a ±5-minute window in which a captured
 * signature+timestamp pair could be resent verbatim. Recording every accepted signature until its
 * timestamp falls out of that window closes the gap: a second request carrying the *same*
 * signature is a replay (the signature covers method, path, timestamp and body hash, so any
 * legitimate new request differs in at least the timestamp).
 *
 * Only consulted for side-effecting methods (POST/PUT/DELETE) — see hmac-auth.ts. Expired entries
 * are evicted lazily on insert, at most once per sweep interval, so the cache needs no timer.
 */
export class ReplayCache {
  private readonly seen = new Map<string, number>();
  private lastSweepAt = 0;

  constructor(
    /** How long an accepted signature stays blocked — at least the HMAC drift window. */
    private readonly ttlMs: number = 10 * 60 * 1000,
    /** Minimum interval between lazy eviction sweeps. */
    private readonly sweepIntervalMs: number = 60 * 1000
  ) {}

  /**
   * Records `signature` and reports whether it was already present (and unexpired) — i.e. whether
   * this request is a replay.
   */
  checkAndRecord(signature: string, now: number = Date.now()): boolean {
    this.sweep(now);
    const expiry = this.seen.get(signature);
    if (expiry !== undefined && expiry > now) {
      return true;
    }
    this.seen.set(signature, now + this.ttlMs);
    return false;
  }

  /** Drops expired entries; runs at most once per sweep interval. */
  private sweep(now: number): void {
    if (now - this.lastSweepAt < this.sweepIntervalMs) return;
    this.lastSweepAt = now;
    for (const [signature, expiry] of this.seen) {
      if (expiry <= now) this.seen.delete(signature);
    }
  }

  /** Empties the cache. Intended for tests, which replay identical signed requests on purpose. */
  clear(): void {
    this.seen.clear();
    this.lastSweepAt = 0;
  }

  get size(): number {
    return this.seen.size;
  }
}
