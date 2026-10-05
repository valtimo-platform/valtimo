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
 * L1 tests for the per-plugin Wasm instance pool, driven by a fake factory so the semantics can be
 * pinned without the cost of real Extism instances: parallelism up to the ceiling, a bounded and
 * fair wait when saturated, destroy-above-minimum, and the "never close an instance mid-call"
 * guarantee that unload/remove/shutdown depend on.
 */

import {describe, expect, it, vi} from "vitest";
import {WasmInstancePool, type WasmInstancePoolOptions} from "./wasm-instance-pool";

interface FakeInstance {
  id: number;
  closed: boolean;
}

function makePool(
  options: Partial<WasmInstancePoolOptions> = {},
  factoryOverride?: () => Promise<FakeInstance>
) {
  let nextId = 1;
  const created: FakeInstance[] = [];
  const closed: FakeInstance[] = [];
  const factory =
    factoryOverride ??
    (async () => {
      const instance = { id: nextId++, closed: false };
      created.push(instance);
      return instance;
    });
  const pool = new WasmInstancePool<FakeInstance>(
    factory,
    async (instance) => {
      instance.closed = true;
      closed.push(instance);
    },
    {
      minInstances: 1,
      maxInstances: 4,
      acquireTimeoutMs: 1_000,
      label: "test-plugin@1.0.0",
      ...options,
    }
  );
  return { pool, created, closed };
}

/** Lets already-queued microtasks and any 0ms timers run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

describe("WasmInstancePool", () => {
  describe("acquire", () => {
    it("creates a new instance per concurrent caller, up to the maximum", async () => {
      const { pool, created } = makePool({ maxInstances: 3 });

      const leases = await Promise.all([pool.acquire(), pool.acquire(), pool.acquire()]);

      expect(created).toHaveLength(3);
      expect(new Set(leases.map((l) => l.instance.id)).size).toBe(3);
      expect(pool.size).toBe(3);
      expect(pool.busyCount).toBe(3);
    });

    it("reuses an idle instance instead of creating another", async () => {
      const { pool, created } = makePool();

      const first = await pool.acquire();
      first.release();
      const second = await pool.acquire();

      expect(created).toHaveLength(1);
      expect(second.instance.id).toBe(first.instance.id);
    });

    it("never overshoots the maximum, even when a burst arrives before the factory resolves", async () => {
      // The slot must be reserved before awaiting the factory; otherwise every caller in the burst
      // sees `size < max` and the pool creates far more instances than the ceiling allows.
      let openGate!: () => void;
      const gate = new Promise<void>((resolve) => {
        openGate = resolve;
      });
      let nextId = 1;
      const created: FakeInstance[] = [];
      const { pool } = makePool({ maxInstances: 2, acquireTimeoutMs: 30 }, async () => {
        await gate;
        const instance = { id: nextId++, closed: false };
        created.push(instance);
        return instance;
      });

      const attempts = [pool.acquire(), pool.acquire(), pool.acquire(), pool.acquire()];
      // Still inside the factory: only two slots may have been claimed, and the other two callers
      // must be queued rather than each starting their own instance.
      expect(pool.size).toBe(2);
      expect(pool.waitingCount).toBe(2);

      openGate();
      const results = await Promise.allSettled(attempts);

      expect(created).toHaveLength(2);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
      for (const result of results) {
        if (result.status === "fulfilled") result.value.release();
      }
    });

    it("queues a caller when every instance is busy, and serves it on release", async () => {
      const { pool, created } = makePool({ maxInstances: 2 });

      const a = await pool.acquire();
      const b = await pool.acquire();
      let served = false;
      const waiting = pool.acquire().then((lease) => {
        served = true;
        return lease;
      });

      await settle();
      expect(served).toBe(false);
      expect(pool.waitingCount).toBe(1);
      expect(created).toHaveLength(2);

      a.release();
      const third = await waiting;
      // Handed the freed instance directly rather than closing and recreating one.
      expect(created).toHaveLength(2);
      expect(third.instance.id).toBe(a.instance.id);

      third.release();
      b.release();
    });

    it("serves queued callers FIFO so a steady stream cannot starve one already waiting", async () => {
      const { pool } = makePool({ maxInstances: 1 });
      const held = await pool.acquire();

      const order: string[] = [];
      const first = pool.acquire().then((l) => {
        order.push("first");
        return l;
      });
      const second = pool.acquire().then((l) => {
        order.push("second");
        return l;
      });
      const third = pool.acquire().then((l) => {
        order.push("third");
        return l;
      });

      held.release();
      (await first).release();
      (await second).release();
      (await third).release();

      expect(order).toEqual(["first", "second", "third"]);
    });

    it("rejects after the acquire timeout and leaves no waiter behind", async () => {
      const { pool } = makePool({ maxInstances: 1, acquireTimeoutMs: 20 });
      const held = await pool.acquire();

      await expect(pool.acquire()).rejects.toThrow(
        /Timed out after 20ms waiting for a free Wasm instance \(test-plugin@1\.0\.0, all 1 instances busy\)/
      );
      expect(pool.waitingCount).toBe(0);

      // The timed-out caller must not still be holding a claim on the next released instance.
      held.release();
      expect(pool.size).toBe(1);
      expect(pool.busyCount).toBe(0);
    });
  });

  describe("release and discard", () => {
    it("closes an instance released above the minimum and keeps one at the minimum idle", async () => {
      const { pool, closed } = makePool({ minInstances: 1, maxInstances: 3 });

      const leases = await Promise.all([pool.acquire(), pool.acquire(), pool.acquire()]);
      for (const lease of leases) lease.release();

      expect(closed).toHaveLength(2);
      expect(pool.size).toBe(1);
      expect(pool.busyCount).toBe(0);
    });

    it("keeps instances up to the configured minimum idle", async () => {
      const { pool, closed } = makePool({ minInstances: 2, maxInstances: 3 });

      const leases = await Promise.all([pool.acquire(), pool.acquire(), pool.acquire()]);
      for (const lease of leases) lease.release();

      expect(closed).toHaveLength(1);
      expect(pool.size).toBe(2);
    });

    it("discards a broken instance and frees its slot for a waiter", async () => {
      const { pool, created, closed } = makePool({ maxInstances: 1 });
      const held = await pool.acquire();
      const waiting = pool.acquire();

      held.discard();

      const replacement = await waiting;
      expect(closed.map((c) => c.id)).toEqual([held.instance.id]);
      expect(created).toHaveLength(2);
      expect(replacement.instance.id).not.toBe(held.instance.id);
      expect(pool.size).toBe(1);
      replacement.release();
    });

    it("ignores a second release or discard on the same lease", async () => {
      const { pool, closed } = makePool({ minInstances: 1, maxInstances: 2 });
      const lease = await pool.acquire();

      lease.release();
      lease.release();
      lease.discard();

      expect(closed).toHaveLength(0);
      expect(pool.size).toBe(1);
      expect(pool.busyCount).toBe(0);
    });
  });

  describe("factory failure", () => {
    it("frees the reserved slot and propagates the error", async () => {
      const factory = vi
        .fn<() => Promise<FakeInstance>>()
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValue({ id: 99, closed: false });
      const { pool } = makePool({ maxInstances: 1 }, factory);

      await expect(pool.acquire()).rejects.toThrow("boom");
      // The slot was released, so the pool is not permanently wedged at its ceiling.
      const lease = await pool.acquire();
      expect(lease.instance.id).toBe(99);
    });

    it("does not stall a queued waiter when the replacement instance cannot be created", async () => {
      let calls = 0;
      const { pool } = makePool({ maxInstances: 1 }, async () => {
        calls++;
        if (calls === 2) throw new Error("factory exhausted");
        return { id: calls, closed: false };
      });

      const held = await pool.acquire();
      const waiting = pool.acquire();
      held.discard(); // frees the slot; the waiter's own factory call then fails

      await expect(waiting).rejects.toThrow("factory exhausted");
      expect(pool.size).toBe(0);
      expect(pool.busyCount).toBe(0);
    });
  });

  describe("evictIdle", () => {
    it("closes an instance idle past the TTL, including below the minimum", async () => {
      const { pool, closed } = makePool({ minInstances: 1 });
      const lease = await pool.acquire();
      lease.release();
      expect(pool.size).toBe(1);

      await pool.evictIdle(60_000);
      expect(closed).toHaveLength(0); // not idle long enough

      await settle();
      await pool.evictIdle(1);

      expect(closed).toHaveLength(1);
      expect(pool.size).toBe(0); // a quiet host returns to zero instances
    });

    it("never touches a leased instance", async () => {
      const { pool, closed } = makePool();
      const busy = await pool.acquire();

      await settle();
      await pool.evictIdle(1);

      expect(closed).toHaveLength(0);
      expect(pool.size).toBe(1);
      busy.release();
    });

    it("does nothing when eviction is disabled", async () => {
      const { pool, closed } = makePool();
      (await pool.acquire()).release();

      await settle();
      await pool.evictIdle(0);

      expect(closed).toHaveLength(0);
    });
  });

  describe("drain", () => {
    it("waits for an in-flight lease before closing its instance", async () => {
      const { pool, closed } = makePool();
      const busy = await pool.acquire();

      let drained = false;
      const draining = pool.drain().then(() => {
        drained = true;
      });

      await settle();
      // This is the guarantee unload/remove/shutdown rely on: a call already running is never
      // killed mid-execution.
      expect(drained).toBe(false);
      expect(closed).toHaveLength(0);

      busy.release();
      await draining;

      expect(drained).toBe(true);
      expect(closed.map((c) => c.id)).toEqual([busy.instance.id]);
      expect(pool.size).toBe(0);
    });

    it("closes every idle instance and refuses later acquires", async () => {
      const { pool, closed } = makePool({ minInstances: 3, maxInstances: 3 });
      const leases = await Promise.all([pool.acquire(), pool.acquire(), pool.acquire()]);
      for (const lease of leases) lease.release();
      expect(pool.size).toBe(3);

      await pool.drain();

      expect(closed).toHaveLength(3);
      expect(pool.size).toBe(0);
      await expect(pool.acquire()).rejects.toThrow(/pool is closed \(test-plugin@1\.0\.0\)/);
    });

    it("rejects callers queued at the moment of the drain", async () => {
      const { pool } = makePool({ maxInstances: 1 });
      const held = await pool.acquire();
      const waiting = pool.acquire();

      const draining = pool.drain();
      await expect(waiting).rejects.toThrow(/pool is closing/);

      held.release();
      await draining;
      expect(pool.size).toBe(0);
    });

    it("is safe to call twice", async () => {
      const { pool } = makePool();
      const busy = await pool.acquire();
      const first = pool.drain();
      const second = pool.drain();

      busy.release();
      await expect(Promise.all([first, second])).resolves.toBeDefined();
    });
  });

  describe("option clamping", () => {
    it("raises a maximum below the minimum to the minimum", async () => {
      const { pool } = makePool({ minInstances: 2, maxInstances: 1 });
      const leases = await Promise.all([pool.acquire(), pool.acquire()]);
      expect(pool.size).toBe(2);
      for (const lease of leases) lease.release();
    });

    it("raises a minimum below 1 to 1", async () => {
      const { pool, closed } = makePool({ minInstances: 0, maxInstances: 2 });
      (await pool.acquire()).release();
      expect(closed).toHaveLength(0);
      expect(pool.size).toBe(1);
    });
  });
});
