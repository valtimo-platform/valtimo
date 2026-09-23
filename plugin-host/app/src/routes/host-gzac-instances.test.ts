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

import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FrameAncestorRegistry } from "../frame-ancestor-registry";
import type { GzacInstanceRepository } from "../db/gzac-instance-repository";
import { resetReplayCacheForTests } from "../security/hmac-auth";
import { buildTestApp, signHeaders, testConfig } from "../test-support/harness";
import { hostGzacInstanceRoutes } from "./host-gzac-instances";

const PATH = "/api/host/gzac-instances";

/**
 * The allowlist this route writes decides who may frame every plugin on the host, so an attacker who
 * could call it — or rewrite a legitimate call in flight — could add their own origin. These tests
 * pin that the shared HMAC scheme is what stands in the way.
 */
describe("host-gzac-instances routes", () => {
  let app: FastifyInstance;
  let repo: { upsert: ReturnType<typeof vi.fn>; listFresh: ReturnType<typeof vi.fn> };
  let registry: FrameAncestorRegistry;

  function body(origins: string[] = ["https://valtimo.example.com"]): string {
    return JSON.stringify({ gzacBaseUrl: "http://gzac:8080", frontendOrigins: origins });
  }

  beforeEach(async () => {
    resetReplayCacheForTests();
    repo = { upsert: vi.fn(async () => {}), listFresh: vi.fn(async () => []) };
    registry = new FrameAncestorRegistry(repo as unknown as GzacInstanceRepository);
    app = await buildTestApp((a) =>
      hostGzacInstanceRoutes(a, { frameAncestorRegistry: registry, config: testConfig() })
    );
  });

  afterEach(async () => {
    await app.close();
  });

  it("registers the announced origins under the GZAC instance key", async () => {
    const payload = body(["https://valtimo.example.com", "http://localhost:4200"]);

    const res = await app.inject({
      method: "PUT",
      url: PATH,
      payload,
      headers: { ...signHeaders("PUT", PATH, payload), "content-type": "application/json" },
    });

    expect(res.statusCode).toBe(200);
    expect(repo.upsert).toHaveBeenCalledWith("http://gzac:8080", [
      "https://valtimo.example.com",
      "http://localhost:4200",
    ]);
  });

  it("drops origins that are not a bare http(s) origin instead of failing the whole announcement", async () => {
    const payload = body(["https://valtimo.example.com", "*", "not-a-url"]);

    const res = await app.inject({
      method: "PUT",
      url: PATH,
      payload,
      headers: { ...signHeaders("PUT", PATH, payload), "content-type": "application/json" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().frontendOrigins).toEqual(["https://valtimo.example.com"]);
  });

  it("rejects an unsigned request", async () => {
    const payload = body();

    const res = await app.inject({
      method: "PUT",
      url: PATH,
      payload,
      headers: { "content-type": "application/json" },
    });

    expect(res.statusCode).toBe(401);
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it("rejects a signature made with the wrong secret", async () => {
    const payload = body();

    const res = await app.inject({
      method: "PUT",
      url: PATH,
      payload,
      headers: {
        ...signHeaders("PUT", PATH, payload, "not-the-admin-token"),
        "content-type": "application/json",
      },
    });

    expect(res.statusCode).toBe(401);
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it("rejects a body swapped after signing — the signature binds the announced origins", async () => {
    const signed = body(["https://valtimo.example.com"]);
    const tampered = body(["https://evil.example"]);

    const res = await app.inject({
      method: "PUT",
      url: PATH,
      payload: tampered,
      headers: { ...signHeaders("PUT", PATH, signed), "content-type": "application/json" },
    });

    expect(res.statusCode).toBe(401);
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it("rejects a replayed announcement", async () => {
    const payload = body();
    const headers = { ...signHeaders("PUT", PATH, payload), "content-type": "application/json" };

    const first = await app.inject({ method: "PUT", url: PATH, payload, headers });
    const replay = await app.inject({ method: "PUT", url: PATH, payload, headers });

    expect(first.statusCode).toBe(200);
    expect(replay.statusCode).toBe(401);
    expect(repo.upsert).toHaveBeenCalledTimes(1);
  });

  it("rejects a body without a GZAC instance key", async () => {
    const payload = JSON.stringify({ frontendOrigins: ["https://valtimo.example.com"] });

    const res = await app.inject({
      method: "PUT",
      url: PATH,
      payload,
      headers: { ...signHeaders("PUT", PATH, payload), "content-type": "application/json" },
    });

    expect(res.statusCode).toBe(400);
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it("accepts an announcement with no origins at all — that is how an admin clears the allowlist", async () => {
    const payload = body([]);

    const res = await app.inject({
      method: "PUT",
      url: PATH,
      payload,
      headers: { ...signHeaders("PUT", PATH, payload), "content-type": "application/json" },
    });

    expect(res.statusCode).toBe(200);
    expect(repo.upsert).toHaveBeenCalledWith("http://gzac:8080", []);
  });
});
