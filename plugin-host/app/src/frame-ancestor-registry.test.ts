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

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GzacInstance, GzacInstanceRepository } from "./db/gzac-instance-repository";
import { FrameAncestorRegistry, normalizeOrigin, normalizeOrigins } from "./frame-ancestor-registry";

/**
 * An in-memory stand-in for the Postgres-backed repository, with the staleness window applied the
 * same way the SQL does — so the registry's own filtering and caching are what is under test here,
 * not the query. `gzac-instance-repository.int.test.ts` covers the SQL against a real database.
 */
function fakeRepo(rows: Array<GzacInstance & { ageMs?: number }> = []) {
  const store = new Map(rows.map((row) => [row.gzacBaseUrl, row]));
  return {
    listFresh: vi.fn(async (staleMs: number) =>
      [...store.values()]
        .filter((row) => (row.ageMs ?? 0) < staleMs)
        .map(({ gzacBaseUrl, frontendOrigins }) => ({ gzacBaseUrl, frontendOrigins }))
    ),
    upsert: vi.fn(async (gzacBaseUrl: string, frontendOrigins: string[]) => {
      store.set(gzacBaseUrl, { gzacBaseUrl, frontendOrigins });
    }),
  } as unknown as GzacInstanceRepository & { listFresh: ReturnType<typeof vi.fn> };
}

describe("normalizeOrigin", () => {
  it("canonicalises scheme, host case and a trailing slash", () => {
    expect(normalizeOrigin("HTTPS://Valtimo.Example.com/")).toBe("https://valtimo.example.com");
    expect(normalizeOrigin("  http://localhost:4200  ")).toBe("http://localhost:4200");
    expect(normalizeOrigin("http://[::1]:4200")).toBe("http://[::1]:4200");
  });

  it("rejects a wildcard, which would defeat the whole allowlist", () => {
    expect(normalizeOrigin("*")).toBeNull();
    expect(normalizeOrigin("https://*.example.com")).toBeNull();
  });

  it("rejects anything that is not a bare http(s) origin", () => {
    expect(normalizeOrigin("https://valtimo.example.com/app")).toBeNull();
    expect(normalizeOrigin("https://valtimo.example.com?q=1")).toBeNull();
    expect(normalizeOrigin("https://valtimo.example.com#x")).toBeNull();
    expect(normalizeOrigin("https://user:pw@valtimo.example.com")).toBeNull();
    expect(normalizeOrigin("ftp://valtimo.example.com")).toBeNull();
    expect(normalizeOrigin("valtimo.example.com")).toBeNull();
    expect(normalizeOrigin("")).toBeNull();
    expect(normalizeOrigin(42)).toBeNull();
  });

  it("drops invalid entries from a list and deduplicates the rest", () => {
    expect(
      normalizeOrigins([
        "https://valtimo.example.com",
        "https://valtimo.example.com/",
        "*",
        "not-a-url",
        42,
      ])
    ).toEqual(["https://valtimo.example.com"]);
    expect(normalizeOrigins("not-an-array")).toEqual([]);
  });
});

describe("FrameAncestorRegistry", () => {
  let repo: ReturnType<typeof fakeRepo>;

  beforeEach(() => {
    repo = fakeRepo([
      { gzacBaseUrl: "http://gzac-a:8080", frontendOrigins: ["https://a.example.com"] },
      { gzacBaseUrl: "http://gzac-b:8080", frontendOrigins: ["https://b.example.com"] },
    ]);
  });

  it("unions the origins of every registered instance", async () => {
    const registry = new FrameAncestorRegistry(repo);

    expect(await registry.allowedOrigins()).toEqual([
      "https://a.example.com",
      "https://b.example.com",
    ]);
  });

  it("adds the environment escape hatch and deduplicates against the registered origins", async () => {
    const registry = new FrameAncestorRegistry(repo, [
      "http://localhost:4200",
      "https://a.example.com/",
    ]);

    expect(await registry.allowedOrigins()).toEqual([
      "https://a.example.com",
      "https://b.example.com",
      "http://localhost:4200",
    ]);
  });

  it("ignores a wildcard in the environment escape hatch", async () => {
    const registry = new FrameAncestorRegistry(fakeRepo(), ["*"]);

    expect(await registry.allowedOrigins()).toEqual([]);
  });

  it("drops an instance that stopped announcing itself", async () => {
    const stale = fakeRepo([
      { gzacBaseUrl: "http://gzac-a:8080", frontendOrigins: ["https://a.example.com"], ageMs: 0 },
      { gzacBaseUrl: "http://gzac-old:8080", frontendOrigins: ["https://old.example.com"], ageMs: 60_000 },
    ]);
    const registry = new FrameAncestorRegistry(stale, [], 30_000);

    expect(await registry.allowedOrigins()).toEqual(["https://a.example.com"]);
  });

  it("registers an instance under its GZAC base URL, normalising what it announced", async () => {
    const registry = new FrameAncestorRegistry(repo);

    await registry.register("http://gzac-c:8080", ["https://C.example.com/", "*"]);

    expect(repo.upsert).toHaveBeenCalledWith("http://gzac-c:8080", ["https://c.example.com"]);
    expect(await registry.allowedOrigins()).toContain("https://c.example.com");
  });

  it("serves reads from the cache, but a write invalidates it immediately", async () => {
    const registry = new FrameAncestorRegistry(repo, [], 30_000, 10_000);

    await registry.allowedOrigins();
    await registry.allowedOrigins();
    expect(repo.listFresh).toHaveBeenCalledTimes(1);

    await registry.register("http://gzac-c:8080", ["https://c.example.com"]);
    expect(await registry.allowedOrigins()).toContain("https://c.example.com");
    expect(repo.listFresh).toHaveBeenCalledTimes(2);
  });

  it("re-reads on every call when caching is disabled", async () => {
    const registry = new FrameAncestorRegistry(repo, [], 30_000, 0);

    await registry.allowedOrigins();
    await registry.allowedOrigins();

    expect(repo.listFresh).toHaveBeenCalledTimes(2);
  });

  it("answers isAllowed by comparing normalised origins", async () => {
    const registry = new FrameAncestorRegistry(repo);

    expect(await registry.isAllowed("https://a.example.com")).toBe(true);
    // The browser sends a bare origin; a trailing slash still has to match what is stored.
    expect(await registry.isAllowed("https://a.example.com/")).toBe(true);
    expect(await registry.isAllowed("https://evil.example")).toBe(false);
    expect(await registry.isAllowed("*")).toBe(false);
    expect(await registry.isAllowed("null")).toBe(false);
  });
});
