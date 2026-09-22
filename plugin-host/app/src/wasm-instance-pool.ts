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

export interface WasmInstancePoolOptions {
  /** Instances kept alive once created; never below 1. */
  minInstances: number;
  /** Hard ceiling on concurrent instances; never below minInstances. */
  maxInstances: number;
  /** How long a caller waits for a free instance before the call fails. */
  acquireTimeoutMs: number;
  /** Names the pool in the acquire-timeout message, e.g. `case-summary@0.1.0`. */
  label?: string;
}

export interface InstanceLease<T> {
  readonly instance: T;
  /** Return the instance to the pool. */
  release(): void;
  /** Close and drop the instance — for a call that left it in an undefined state. */
  discard(): void;
}

interface PooledInstance<T> {
  instance: T;
  /** When it last returned to the idle set — drives {@link WasmInstancePool.evictIdle}. */
  idleSince: number;
}

interface Waiter<T> {
  resolve(lease: InstanceLease<T>): void;
  reject(err: Error): void;
  timer: ReturnType<typeof setTimeout> | null;
  settled: boolean;
}

/**
 * A bounded pool of Wasm instances for ONE loaded plugin version.
 *
 * An Extism instance is not reentrant — a second `call` while one is in flight throws "plugin is
 * not reentrant" — so parallelism comes from having several instances rather than from sharing one.
 * Each instance holds a worker thread and its own linear memory, hence the hard ceiling: the
 * worst-case memory footprint of a plugin version is `maxInstances × the per-instance memory cap`.
 *
 * Instances above `minInstances` are closed the moment they finish, so a burst does not pin its
 * peak footprint afterwards; the ones at or below the minimum stay warm until the idle sweep
 * reclaims them. Creation is lazy throughout — `minInstances` means "retained while in use", not
 * "pre-warmed", so a quiet host still costs nothing.
 */
export class WasmInstancePool<T> {
  private idle: PooledInstance<T>[] = [];
  private waiters: Waiter<T>[] = [];
  /** Instances that exist: idle + leased + slots reserved for an in-flight factory call. */
  private total = 0;
  private busy = 0;
  private draining = false;
  private drainResolvers: Array<() => void> = [];

  private readonly minInstances: number;
  private readonly maxInstances: number;
  private readonly acquireTimeoutMs: number;
  private readonly label: string;

  constructor(
    private readonly factory: () => Promise<T>,
    private readonly closeInstance: (instance: T) => Promise<void>,
    options: WasmInstancePoolOptions
  ) {
    this.minInstances = Math.max(1, options.minInstances);
    this.maxInstances = Math.max(this.minInstances, options.maxInstances);
    this.acquireTimeoutMs = Math.max(1, options.acquireTimeoutMs);
    this.label = options.label ?? "plugin";
  }

  /** Instances that exist right now (idle + leased). */
  get size(): number {
    return this.total;
  }

  /** Instances currently leased to a caller. */
  get busyCount(): number {
    return this.busy;
  }

  /** Callers waiting for a free instance. */
  get waitingCount(): number {
    return this.waiters.length;
  }

  /**
   * Takes an instance for the duration of one call. Reuses an idle instance if there is one,
   * otherwise creates one while below the maximum, otherwise queues until a lease is released or
   * {@link acquireTimeoutMs} elapses.
   */
  async acquire(): Promise<InstanceLease<T>> {
    if (this.draining) {
      throw new Error(`Plugin instance pool is closed (${this.label})`);
    }

    // Most-recently-used first: the hottest instance stays warm and colder ones age out to the
    // idle sweep instead of every instance being kept marginally alive.
    const pooled = this.idle.pop();
    if (pooled) {
      this.busy++;
      return this.lease(pooled.instance);
    }

    if (this.total < this.maxInstances) {
      // Reserve the slot BEFORE awaiting the factory, so a burst of concurrent acquires cannot
      // each see `total < max` and overshoot the ceiling.
      this.total++;
      this.busy++;
      try {
        const instance = await this.factory();
        return this.lease(instance);
      } catch (err) {
        this.total--;
        this.busy--;
        // The reserved slot is free again — a queued waiter may now be able to create its own.
        this.pump();
        throw err;
      }
    }

    return this.wait();
  }

  /**
   * Closes idle instances untouched for longer than `idleTtlMs`, including below the minimum, so a
   * host with no traffic returns to zero instances. Leased instances are never touched.
   */
  async evictIdle(idleTtlMs: number): Promise<void> {
    if (idleTtlMs <= 0) return;
    const now = Date.now();
    const expired = this.idle.filter((p) => now - p.idleSince >= idleTtlMs);
    if (expired.length === 0) return;
    this.idle = this.idle.filter((p) => !expired.includes(p));
    this.total -= expired.length;
    await Promise.all(expired.map((p) => this.safeClose(p.instance)));
  }

  /**
   * Stops admitting callers, rejects everyone queued, waits for in-flight leases to be released,
   * then closes every instance. This is what makes unload/remove/shutdown safe: a call already
   * running against an instance always finishes before that instance is closed.
   */
  async drain(): Promise<void> {
    this.draining = true;

    for (const waiter of this.waiters.splice(0)) {
      this.settle(waiter, () =>
        waiter.reject(new Error(`Plugin instance pool is closing (${this.label})`))
      );
    }

    if (this.busy > 0) {
      await new Promise<void>((resolve) => {
        this.drainResolvers.push(resolve);
      });
    }

    const remaining = this.idle.splice(0);
    this.total -= remaining.length;
    await Promise.all(remaining.map((p) => this.safeClose(p.instance)));
  }

  private lease(instance: T): InstanceLease<T> {
    let settled = false;
    return {
      instance,
      release: () => {
        if (settled) return;
        settled = true;
        this.busy--;
        this.giveBack(instance);
        this.checkDrained();
      },
      discard: () => {
        if (settled) return;
        settled = true;
        this.busy--;
        this.total--;
        void this.safeClose(instance);
        // The slot is free again — without this a discard would leave waiters stalled until an
        // unrelated release happened to come along.
        this.pump();
        this.checkDrained();
      },
    };
  }

  /** Routes a finished instance to a waiter, back to the idle set, or to closure. */
  private giveBack(instance: T): void {
    const waiter = this.nextWaiter();
    if (waiter) {
      // Hand it straight over rather than closing an instance only to recreate one immediately.
      this.busy++;
      this.settle(waiter, () => waiter.resolve(this.lease(instance)));
      return;
    }

    if (this.draining || this.total > this.minInstances) {
      this.total--;
      void this.safeClose(instance);
      return;
    }

    this.idle.push({ instance, idleSince: Date.now() });
  }

  /** Queues the caller FIFO, so a steady stream of new callers cannot starve one already waiting. */
  private wait(): Promise<InstanceLease<T>> {
    return new Promise<InstanceLease<T>>((resolve, reject) => {
      const waiter: Waiter<T> = { resolve, reject, timer: null, settled: false };
      waiter.timer = setTimeout(() => {
        const index = this.waiters.indexOf(waiter);
        if (index !== -1) this.waiters.splice(index, 1);
        this.settle(waiter, () =>
          reject(
            new Error(
              `Timed out after ${this.acquireTimeoutMs}ms waiting for a free Wasm instance ` +
                `(${this.label}, all ${this.maxInstances} instances busy)`
            )
          )
        );
      }, this.acquireTimeoutMs);
      waiter.timer.unref?.();
      this.waiters.push(waiter);
    });
  }

  /** Lets a queued waiter create its own instance after a slot was freed without an instance. */
  private pump(): void {
    while (this.waiters.length > 0 && this.total < this.maxInstances && !this.draining) {
      const waiter = this.nextWaiter();
      if (!waiter) return;
      this.total++;
      this.busy++;
      this.factory().then(
        (instance) => {
          if (waiter.settled) {
            // The waiter's acquire timeout fired while its instance was being created. Return the
            // instance to the pool rather than orphaning it (and its reserved slot).
            this.busy--;
            this.giveBack(instance);
            this.checkDrained();
            return;
          }
          this.settle(waiter, () => waiter.resolve(this.lease(instance)));
        },
        (err) => {
          this.total--;
          this.busy--;
          this.settle(waiter, () => waiter.reject(err as Error));
          this.checkDrained();
        }
      );
    }
  }

  private nextWaiter(): Waiter<T> | undefined {
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift()!;
      if (!waiter.settled) return waiter;
    }
    return undefined;
  }

  private settle(waiter: Waiter<T>, action: () => void): void {
    if (waiter.settled) return;
    waiter.settled = true;
    if (waiter.timer) clearTimeout(waiter.timer);
    action();
  }

  private checkDrained(): void {
    if (this.draining && this.busy === 0) {
      for (const resolve of this.drainResolvers.splice(0)) resolve();
    }
  }

  private async safeClose(instance: T): Promise<void> {
    try {
      await this.closeInstance(instance);
    } catch {
      // A close failure must never fail the call that released the instance.
    }
  }
}
