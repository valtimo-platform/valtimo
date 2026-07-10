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

import type {FastifyReply, FastifyRequest} from "fastify";
import {describe, expect, it, vi} from "vitest";
import {computeBodyHash, computeSignature} from "./hmac";
import {createHmacAuthHook, verifyDeferredHmac, verifyHmacRequest} from "./hmac-auth";

const SECRET = "hook-secret";

function signedHeaders(method: string, path: string, body: Buffer, secret = SECRET) {
  const timestamp = new Date().toISOString();
  const signature = computeSignature(secret, method, path, timestamp, computeBodyHash(body));
  return { "x-valtimo-signature": signature, "x-valtimo-timestamp": timestamp };
}

function fakeRequest(opts: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  rawBody?: Buffer;
  deferHmac?: boolean;
}): FastifyRequest {
  return {
    method: opts.method,
    url: opts.url,
    headers: opts.headers ?? {},
    rawBody: opts.rawBody,
    routeOptions: { config: { deferHmac: opts.deferHmac } },
    log: { warn: vi.fn() },
  } as unknown as FastifyRequest;
}

function fakeReply() {
  const reply = {
    code: vi.fn((): typeof reply => reply),
    send: vi.fn((): typeof reply => reply),
  };
  return reply as unknown as FastifyReply & { code: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> };
}

describe("createHmacAuthHook", () => {
  it("passes a correctly signed request through (no reply sent)", async () => {
    const body = Buffer.from('{"a":1}', "utf8");
    const request = fakeRequest({
      method: "POST",
      url: "/api/host/configurations/x",
      headers: signedHeaders("POST", "/api/host/configurations/x", body),
      rawBody: body,
    });
    const reply = fakeReply();

    await createHmacAuthHook(SECRET)(request, reply, () => {});

    expect(reply.code).not.toHaveBeenCalled();
  });

  it("rejects an unsigned request with 401", async () => {
    const request = fakeRequest({ method: "GET", url: "/api/host/plugins" });
    const reply = fakeReply();

    await createHmacAuthHook(SECRET)(request, reply, () => {});

    expect(reply.code).toHaveBeenCalledWith(401);
  });

  it("rejects a request signed with the wrong secret", async () => {
    const request = fakeRequest({
      method: "GET",
      url: "/api/host/plugins",
      headers: signedHeaders("GET", "/api/host/plugins", Buffer.alloc(0), "attacker-secret"),
    });
    const reply = fakeReply();

    await createHmacAuthHook(SECRET)(request, reply, () => {});

    expect(reply.code).toHaveBeenCalledWith(401);
  });

  it("binds an empty body for a request with no rawBody (GET/DELETE)", async () => {
    const request = fakeRequest({
      method: "DELETE",
      url: "/api/host/configurations/x",
      headers: signedHeaders("DELETE", "/api/host/configurations/x", Buffer.alloc(0)),
    });
    const reply = fakeReply();

    await createHmacAuthHook(SECRET)(request, reply, () => {});

    expect(reply.code).not.toHaveBeenCalled();
  });

  it("skips verification entirely for a deferHmac route", async () => {
    // No signature headers at all, yet the hook must not reject — the route verifies itself later.
    const request = fakeRequest({ method: "POST", url: "/api/host/plugins", deferHmac: true });
    const reply = fakeReply();

    await createHmacAuthHook(SECRET)(request, reply, () => {});

    expect(reply.code).not.toHaveBeenCalled();
  });
});

describe("verifyHmacRequest", () => {
  it("signs over the path with the query string removed", () => {
    const path = "/api/host/configurations";
    const request = fakeRequest({
      method: "GET",
      url: `${path}?foo=bar&baz=1`,
      headers: signedHeaders("GET", path, Buffer.alloc(0)),
    });

    expect(verifyHmacRequest(request, SECRET, Buffer.alloc(0)).valid).toBe(true);
  });
});

describe("verifyDeferredHmac", () => {
  it("returns true and sends nothing for a body-bound valid signature", () => {
    const fileBytes = Buffer.from("PK-zip-bytes");
    const request = fakeRequest({
      method: "POST",
      url: "/api/host/plugins",
      headers: signedHeaders("POST", "/api/host/plugins", fileBytes),
    });
    const reply = fakeReply();

    expect(verifyDeferredHmac(request, reply, SECRET, fileBytes)).toBe(true);
    expect(reply.code).not.toHaveBeenCalled();
  });

  it("returns false and replies 401 when the bound body does not match the signature", () => {
    const request = fakeRequest({
      method: "POST",
      url: "/api/host/plugins",
      headers: signedHeaders("POST", "/api/host/plugins", Buffer.from("original")),
    });
    const reply = fakeReply();

    expect(verifyDeferredHmac(request, reply, SECRET, Buffer.from("tampered"))).toBe(false);
    expect(reply.code).toHaveBeenCalledWith(401);
  });
});
