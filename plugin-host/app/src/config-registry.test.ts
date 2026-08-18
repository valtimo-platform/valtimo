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

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {ConfigRegistry} from "./config-registry";
import type {PluginConfiguration} from "./models/index.js";

function makeConfig(id: string): PluginConfiguration {
  return {
    configurationId: id,
    pluginId: "case-summary",
    pluginVersion: "0.1.0",
    properties: {},
    serviceToken: "svc",
    gzacBaseUrl: "http://gzac:8080",
    eventSubscriptions: [],
  };
}

describe("ConfigRegistry cache", () => {
  let repo: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    listByPlugin: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    repo = {
      get: vi.fn(async (id: string) => makeConfig(id)),
      set: vi.fn(async () => {}),
      delete: vi.fn(async () => true),
      list: vi.fn(async () => [makeConfig("cfg-1")]),
      listByPlugin: vi.fn(async () => []),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("serves repeated get() calls from the cache within the TTL", async () => {
    const registry = new ConfigRegistry(repo as never, 10_000);
    await registry.get("cfg-1");
    await registry.get("cfg-1");
    expect(repo.get).toHaveBeenCalledTimes(1);
  });

  it("serves repeated list() calls from the cache within the TTL, and primes get()", async () => {
    const registry = new ConfigRegistry(repo as never, 10_000);
    await registry.list();
    await registry.list();
    await registry.get("cfg-1");
    expect(repo.list).toHaveBeenCalledTimes(1);
    expect(repo.get).not.toHaveBeenCalled();
  });

  it("re-reads after the TTL expires", async () => {
    const registry = new ConfigRegistry(repo as never, 10_000);
    await registry.get("cfg-1");
    vi.advanceTimersByTime(10_001);
    await registry.get("cfg-1");
    expect(repo.get).toHaveBeenCalledTimes(2);
  });

  it("invalidates on set() so a push is visible immediately", async () => {
    const registry = new ConfigRegistry(repo as never, 10_000);
    await registry.get("cfg-1");
    await registry.set("cfg-1", makeConfig("cfg-1"));
    await registry.get("cfg-1");
    expect(repo.get).toHaveBeenCalledTimes(2);
  });

  it("invalidates on delete()", async () => {
    const registry = new ConfigRegistry(repo as never, 10_000);
    await registry.list();
    await registry.delete("cfg-1");
    await registry.list();
    expect(repo.list).toHaveBeenCalledTimes(2);
  });

  it("caches negative lookups too (unknown id) within the TTL", async () => {
    repo.get.mockResolvedValue(undefined);
    const registry = new ConfigRegistry(repo as never, 10_000);
    expect(await registry.get("ghost")).toBeUndefined();
    expect(await registry.get("ghost")).toBeUndefined();
    expect(repo.get).toHaveBeenCalledTimes(1);
  });

  it("bypasses the cache entirely when the TTL is 0", async () => {
    const registry = new ConfigRegistry(repo as never, 0);
    await registry.get("cfg-1");
    await registry.get("cfg-1");
    await registry.list();
    await registry.list();
    expect(repo.get).toHaveBeenCalledTimes(2);
    expect(repo.list).toHaveBeenCalledTimes(2);
  });
});
