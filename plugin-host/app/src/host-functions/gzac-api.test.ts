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
import type {HostLogger} from "../models/index.js";
import {createGzacApiHostFunction, type GzacApiCallContext} from "./gzac-api";

function noopLogger(): HostLogger {
  const l: HostLogger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    child: () => l,
  };
  return l;
}

/**
 * Drives the `gzac_api` host function with a fake Extism CallContext: `hostContext()` returns the
 * per-call token context, `read(addr)` yields the plugin's request JSON, and `store()` captures the
 * reply the plugin would receive. Returns the parsed reply.
 */
function invoke(hostCtx: GzacApiCallContext | undefined, request: unknown) {
  const stored: string[] = [];
  const inputJson = typeof request === "string" ? request : JSON.stringify(request);
  const callContext = {
    hostContext: () => hostCtx,
    read: (_addr: bigint) => ({ string: () => inputJson }),
    store: (s: string) => {
      stored.push(s);
      return 0n;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  const fn = createGzacApiHostFunction(noopLogger());
  return fn(callContext, 0n).then(() => JSON.parse(stored.at(-1)!));
}

const baseCtx: GzacApiCallContext = {
  configurationId: "cfg-1",
  pluginId: "case-summary",
  pluginVersion: "0.1.0",
  serviceToken: "service-token-abc",
  gzacBaseUrl: "http://gzac:8080",
};

describe("gzac_api host function", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("credential selection", () => {
    it("uses the service token by default", async () => {
      await invoke(baseCtx, { method: "GET", path: "/api/v1/foo" });
      const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer service-token-abc");
    });

    it("uses the downscoped user token when the request asks for as:'user'", async () => {
      await invoke({ ...baseCtx, userToken: "user-token-xyz" }, {
        method: "GET",
        path: "/api/v1/foo",
        as: "user",
      });
      const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer user-token-xyz");
    });

    it("returns 401 and does NOT fetch when as:'user' but no user token is present", async () => {
      const reply = await invoke(baseCtx, { method: "GET", path: "/api/v1/foo", as: "user" });
      expect(reply.status).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("request validation", () => {
    it("returns 500 when there is no invocation context", async () => {
      const reply = await invoke(undefined, { method: "GET", path: "/api/v1/foo" });
      expect(reply.status).toBe(500);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns 400 on unparseable request JSON", async () => {
      const reply = await invoke(baseCtx, "{not json");
      expect(reply.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns 400 when method is missing", async () => {
      const reply = await invoke(baseCtx, { path: "/api/v1/foo" });
      expect(reply.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns 400 when path does not start with '/'", async () => {
      const reply = await invoke(baseCtx, { method: "GET", path: "api/v1/foo" });
      expect(reply.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("URL + body handling", () => {
    it("joins gzacBaseUrl and path, trimming a trailing slash on the base", async () => {
      await invoke({ ...baseCtx, gzacBaseUrl: "http://gzac:8080/" }, {
        method: "GET",
        path: "/api/v1/foo",
      });
      expect(fetchMock.mock.calls[0][0]).toBe("http://gzac:8080/api/v1/foo");
    });

    it("JSON-encodes an object body and defaults Content-Type to application/json", async () => {
      await invoke(baseCtx, { method: "POST", path: "/api/v1/foo", body: { a: 1 } });
      const init = fetchMock.mock.calls[0][1];
      expect(init.body).toBe(JSON.stringify({ a: 1 }));
      expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    });

    it("passes a string body through verbatim without forcing Content-Type", async () => {
      await invoke(baseCtx, { method: "POST", path: "/api/v1/foo", body: "raw-text" });
      const init = fetchMock.mock.calls[0][1];
      expect(init.body).toBe("raw-text");
      expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
    });

    it("upper-cases the HTTP method", async () => {
      await invoke(baseCtx, { method: "post", path: "/api/v1/foo" });
      expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    });
  });

  describe("response handling", () => {
    it("parses a JSON response body", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ hello: "world" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );
      const reply = await invoke(baseCtx, { method: "GET", path: "/api/v1/foo" });
      expect(reply.status).toBe(200);
      expect(reply.body).toEqual({ hello: "world" });
    });

    it("returns a non-JSON response body as raw text", async () => {
      fetchMock.mockResolvedValueOnce(new Response("plain text", { status: 200 }));
      const reply = await invoke(baseCtx, { method: "GET", path: "/api/v1/foo" });
      expect(reply.body).toBe("plain text");
    });

    it("passes through a non-2xx status from GZAC", async () => {
      fetchMock.mockResolvedValueOnce(new Response("forbidden", { status: 403 }));
      const reply = await invoke(baseCtx, { method: "GET", path: "/api/v1/foo" });
      expect(reply.status).toBe(403);
    });

    it("returns 502 when the fetch itself throws", async () => {
      fetchMock.mockRejectedValueOnce(new Error("connection refused"));
      const reply = await invoke(baseCtx, { method: "GET", path: "/api/v1/foo" });
      expect(reply.status).toBe(502);
    });
  });
});
