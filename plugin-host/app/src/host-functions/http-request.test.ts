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
import type {LogRepository} from "../db/log-repository.js";
import type {HostLogger} from "../models/index.js";
import type {GzacApiCallContext} from "./gzac-api.js";

// `http-request.ts` imports `fetch`/`Agent` from undici rather than using the globals, so the
// module itself has to be mocked — stubbing globalThis.fetch (as the gzac_api specs do) would not
// intercept anything here.
const {fetchMock, agentCtor} = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  agentCtor: vi.fn(),
}));

vi.mock("undici", () => ({
  fetch: fetchMock,
  Agent: class MockAgent {
    constructor(options?: unknown) {
      agentCtor(options);
    }
  },
}));

const {createHttpRequestHostFunction, redactUrl} = await import("./http-request");

describe("redactUrl", () => {
  it("strips the query string (tokens routinely travel there)", () => {
    expect(redactUrl("https://api.example.com/v1/items?apiKey=SECRET&x=1")).toBe(
      "https://api.example.com/v1/items"
    );
  });

  it("strips userinfo credentials", () => {
    expect(redactUrl("https://user:hunter2@api.example.com/v1/items")).toBe(
      "https://api.example.com/v1/items"
    );
  });

  it("strips fragments and keeps the port", () => {
    expect(redactUrl("https://api.example.com:8443/v1/items#section?x=1")).toBe(
      "https://api.example.com:8443/v1/items"
    );
  });

  it("degrades gracefully for an unparseable URL", () => {
    expect(redactUrl("not a url?secret=1")).toBe("not a url");
  });
});

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

interface LogRepoDouble {
  repo: LogRepository;
  insert: ReturnType<typeof vi.fn>;
}

function logRepoDouble(insertImpl: () => Promise<void> = async () => {}): LogRepoDouble {
  const insert = vi.fn(insertImpl);
  return {repo: {insert} as unknown as LogRepository, insert};
}

const baseCtx: GzacApiCallContext = {
  configurationId: "cfg-1",
  pluginId: "case-summary",
  pluginVersion: "0.1.0",
  serviceToken: "service-token-abc",
  gzacBaseUrl: "https://gzac.example.com",
  grantedCapabilities: ["http_request"],
  // http_request is deny-by-default, so every destination a spec expects to reach has to be declared
  // here — the same list GZAC pushes, unioned from the manifest and the x-egress-target properties.
  allowedEgress: [
    "api.example.com",
    "http://api.example.com",
    "other.example.com",
    "elsewhere.example.com",
    "internal.example.com",
    "https://gzac.example.com:9443",
    "https://127.0.0.1",
    "https://169.254.169.254",
    "https://[::1]",
    "https://[::ffff:127.0.0.1]",
  ],
};

interface InvokeOptions {
  ctx?: GzacApiCallContext;
  /** Drives the "Extism gave us no host context" path — distinct from omitting `ctx`. */
  noContext?: boolean;
  allowHttp?: boolean;
  allowPrivateNetwork?: boolean;
  logRepository?: LogRepository;
}

/**
 * Drives the `http_request` host function with a fake Extism CallContext, mirroring the gzac_api
 * specs: `hostContext()` supplies the per-call context, `read(addr)` the plugin's request JSON, and
 * `store()` captures the reply the plugin receives.
 */
async function invoke(
  request: unknown,
  {
    ctx = baseCtx,
    noContext = false,
    allowHttp = false,
    allowPrivateNetwork = false,
    logRepository,
  }: InvokeOptions = {}
) {
  const stored: string[] = [];
  const inputJson = typeof request === "string" ? request : JSON.stringify(request);
  const callContext = {
    hostContext: () => (noContext ? undefined : ctx),
    read: (_addr: bigint) => ({string: () => inputJson}),
    store: (s: string) => {
      stored.push(s);
      return 0n;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  const fn = createHttpRequestHostFunction(
    noopLogger(),
    logRepository ?? logRepoDouble().repo,
    allowHttp,
    allowPrivateNetwork
  );
  await fn(callContext, 0n);
  return JSON.parse(stored.at(-1)!);
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: {"content-type": "application/json", ...headers},
  });
}

function redirectResponse(status: number, location: string): Response {
  return new Response(null, {status, headers: {location}});
}

/** The last `fetch` call's init object. */
function lastInit(): Record<string, unknown> {
  return fetchMock.mock.calls.at(-1)![1] as Record<string, unknown>;
}

describe("http_request host function", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    agentCtor.mockReset();
    // `mockImplementation`, not `mockResolvedValue`: a Response body reads only once, so sharing a
    // single instance would push every call after the first down the host function's error path.
    fetchMock.mockImplementation(async () => jsonResponse({ok: true}));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("capability gate and request parsing", () => {
    it("returns 403 and does NOT fetch when the http_request capability is not granted", async () => {
      const reply = await invoke(
        {method: "GET", url: "https://api.example.com/x"},
        {ctx: {...baseCtx, grantedCapabilities: ["gzac_api"]}}
      );
      expect(reply.status).toBe(403);
      expect(reply.body.error).toContain("Capability 'http_request' not granted");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("denies a configuration pushed without any capabilities (no implicit grant)", async () => {
      const reply = await invoke(
        {method: "GET", url: "https://api.example.com/x"},
        {ctx: {...baseCtx, grantedCapabilities: []}}
      );
      expect(reply.status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns 500 when there is no invocation context", async () => {
      const reply = await invoke({method: "GET", url: "https://api.example.com/x"}, {noContext: true});
      expect(reply.status).toBe(500);
      expect(reply.body.error).toContain("No active invocation context");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns 400 on unparseable request JSON", async () => {
      const reply = await invoke("{not json");
      expect(reply.status).toBe(400);
      expect(reply.body.error).toContain("Invalid http_request request JSON");
    });

    it("returns 400 when method is missing or not a string", async () => {
      expect((await invoke({url: "https://api.example.com/x"})).body.error).toBe("Missing 'method'");
      expect((await invoke({method: 42, url: "https://api.example.com/x"})).body.error).toBe(
        "Missing 'method'"
      );
    });

    it("returns 400 when url is missing or not a string", async () => {
      expect((await invoke({method: "GET"})).body.error).toBe("Missing 'url'");
      expect((await invoke({method: "GET", url: 42})).body.error).toBe("Missing 'url'");
    });

    it("returns 400 for an unparseable url", async () => {
      const reply = await invoke({method: "GET", url: "not a url"});
      expect(reply.status).toBe(400);
      expect(reply.body.error).toBe("Invalid URL");
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("target policy", () => {
    it("rejects a non-http(s) scheme", async () => {
      for (const url of ["file:///etc/passwd", "ftp://files.example.com/x"]) {
        const reply = await invoke({method: "GET", url});
        expect(reply.status).toBe(400);
        expect(reply.body.error).toBe("Only http(s) URLs are supported");
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects plain http by default and names the dev override", async () => {
      const reply = await invoke({method: "GET", url: "http://api.example.com/x"});
      expect(reply.status).toBe(400);
      expect(reply.body.error).toContain("HOST_ALLOW_HTTP=true");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("allows plain http when HOST_ALLOW_HTTP is set", async () => {
      const reply = await invoke(
        {method: "GET", url: "http://api.example.com/x"},
        {allowHttp: true}
      );
      expect(reply.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("refuses a call to the configuration's GZAC origin — that is gzac_api's job", async () => {
      const reply = await invoke({
        method: "GET",
        url: "https://gzac.example.com/api/v1/document/1",
      });
      expect(reply.status).toBe(400);
      expect(reply.body.error).toBe("Use gzac_api to call the GZAC instance, not http_request");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("allows a different origin on the same host name as GZAC's port neighbour", async () => {
      // Origin comparison includes the port: a different port is a different origin.
      const reply = await invoke({method: "GET", url: "https://gzac.example.com:9443/x"});
      expect(reply.status).toBe(200);
    });

    it("skips the GZAC check when gzacBaseUrl is unparseable", async () => {
      const reply = await invoke(
        {method: "GET", url: "https://api.example.com/x"},
        {ctx: {...baseCtx, gzacBaseUrl: "://nonsense"}}
      );
      expect(reply.status).toBe(200);
    });

    it.each([
      "https://127.0.0.1/admin",
      "https://169.254.169.254/latest/meta-data/",
      "https://[::1]/admin",
      "https://[::ffff:127.0.0.1]/admin",
    ])("rejects the private IP literal %s before any socket is opened", async (url) => {
      const reply = await invoke({method: "GET", url});
      expect(reply.status).toBe(400);
      expect(reply.body.error).toContain("private or reserved range");
      expect(reply.body.error).toContain("HOST_ALLOW_PRIVATE_NETWORK=true");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("allows a private IP literal when HOST_ALLOW_PRIVATE_NETWORK is set", async () => {
      const reply = await invoke(
        {method: "GET", url: "https://127.0.0.1/admin"},
        {allowPrivateNetwork: true}
      );
      expect(reply.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("keeps rejecting a private IP literal that is declared as an egress target", async () => {
      // The address envelope is not overridable by a declaration: naming a loopback origin in a
      // manifest or a config property does not make it reachable — only the operator's carve-out does.
      const reply = await invoke({method: "GET", url: "https://127.0.0.1/admin"});
      expect(reply.status).toBe(400);
      expect(reply.body.error).toContain("private or reserved range");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("builds a DNS-guarded dispatcher by default and a plain one when private networks are allowed", async () => {
      createHttpRequestHostFunction(noopLogger(), logRepoDouble().repo, false, false);
      expect(agentCtor).toHaveBeenCalledTimes(1);
      expect(agentCtor.mock.calls[0][0]).toHaveProperty("connect.lookup");

      agentCtor.mockReset();
      createHttpRequestHostFunction(noopLogger(), logRepoDouble().repo, false, true);
      expect(agentCtor).toHaveBeenCalledTimes(1);
      expect(agentCtor.mock.calls[0][0]).toBeUndefined();
    });
  });

  describe("egress allowlist — deny by default", () => {
    it("refuses a destination the configuration never declared, before any fetch", async () => {
      const reply = await invoke({method: "GET", url: "https://attacker.example.com/collect"});
      expect(reply.status).toBe(400);
      expect(reply.body.error).toContain("not in this configuration's egress allowlist");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("refuses everything when the configuration carries no egress targets at all", async () => {
      const reply = await invoke(
        {method: "GET", url: "https://api.example.com/x"},
        {ctx: {...baseCtx, allowedEgress: []}}
      );
      expect(reply.status).toBe(400);
      expect(reply.body.error).toContain("has no egress targets");
      expect(reply.body.error).toContain("permissions.egress");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("refuses everything when the push carried no allowlist (older GZAC — no implicit grant)", async () => {
      const reply = await invoke(
        {method: "GET", url: "https://api.example.com/x"},
        {ctx: {...baseCtx, allowedEgress: undefined}}
      );
      expect(reply.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("allows a declared origin", async () => {
      const reply = await invoke(
        {method: "GET", url: "https://svc.vendor.com/v1/things"},
        {ctx: {...baseCtx, allowedEgress: ["svc.vendor.com"]}}
      );
      expect(reply.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("does not let a scheme-less declaration authorise an http downgrade", async () => {
      // `svc.vendor.com` means https on 443. Hostname-only matching would let this through the moment
      // an operator sets HOST_ALLOW_HTTP=true.
      const reply = await invoke(
        {method: "GET", url: "http://svc.vendor.com/v1"},
        {ctx: {...baseCtx, allowedEgress: ["svc.vendor.com"]}, allowHttp: true}
      );
      expect(reply.status).toBe(400);
      expect(reply.body.error).toContain("not in this configuration's egress allowlist");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("treats a portless declaration as the default port only", async () => {
      const reply = await invoke(
        {method: "GET", url: "https://svc.vendor.com:9200/_search"},
        {ctx: {...baseCtx, allowedEgress: ["svc.vendor.com"]}}
      );
      expect(reply.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("honours an explicit non-default port", async () => {
      const reply = await invoke(
        {method: "GET", url: "https://sd.acme-acc.internal:8443/api/doc"},
        {ctx: {...baseCtx, allowedEgress: ["https://sd.acme-acc.internal:8443"]}}
      );
      expect(reply.status).toBe(200);
    });

    it("accepts one subdomain under a wildcard, but not the apex or a deeper name", async () => {
      const ctx = {...baseCtx, allowedEgress: ["*.vendor.com"]};
      expect((await invoke({method: "GET", url: "https://api.vendor.com/x"}, {ctx})).status).toBe(200);
      expect((await invoke({method: "GET", url: "https://vendor.com/x"}, {ctx})).status).toBe(400);
      expect((await invoke({method: "GET", url: "https://a.b.vendor.com/x"}, {ctx})).status).toBe(400);
    });

    it("re-checks the allowlist on every redirect hop", async () => {
      // The laundering case: an allowlisted host 302s onward to an undeclared one.
      fetchMock.mockResolvedValueOnce(
        redirectResponse(302, "https://attacker.example.com/collect?d=leaked")
      );
      const reply = await invoke({method: "GET", url: "https://api.example.com/x"});
      expect(reply.status).toBe(400);
      expect(reply.body.error).toContain("blocked:");
      expect(reply.body.error).toContain("egress allowlist");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("still applies when the private-network escape hatch is on — it is a separate layer", async () => {
      const reply = await invoke(
        {method: "GET", url: "https://attacker.example.com/collect"},
        {allowPrivateNetwork: true}
      );
      expect(reply.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("request shaping", () => {
    it("upper-cases the method and passes the dispatcher and a manual redirect policy", async () => {
      await invoke({method: "post", url: "https://api.example.com/x"});
      const init = lastInit();
      expect(init.method).toBe("POST");
      expect(init.redirect).toBe("manual");
      expect(init.dispatcher).toBeDefined();
    });

    it("JSON-encodes an object body and defaults Content-Type to application/json", async () => {
      await invoke({method: "POST", url: "https://api.example.com/x", body: {a: 1}});
      const init = lastInit();
      expect(init.body).toBe('{"a":1}');
      expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    });

    it("does not overwrite a caller-supplied content type", async () => {
      await invoke({
        method: "POST",
        url: "https://api.example.com/x",
        body: {a: 1},
        headers: {"content-type": "application/vnd.custom+json"},
      });
      const headers = lastInit().headers as Record<string, string>;
      expect(headers["content-type"]).toBe("application/vnd.custom+json");
      expect(headers["Content-Type"]).toBeUndefined();
    });

    it("passes a string body through verbatim without forcing a content type", async () => {
      await invoke({method: "POST", url: "https://api.example.com/x", body: "raw-text"});
      const init = lastInit();
      expect(init.body).toBe("raw-text");
      expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
    });

    it("sends no body for a null or absent body", async () => {
      await invoke({method: "GET", url: "https://api.example.com/x"});
      expect(lastInit().body).toBeUndefined();
      await invoke({method: "POST", url: "https://api.example.com/x", body: null});
      expect(lastInit().body).toBeUndefined();
    });

    it("defaults the Accept header and keeps caller headers", async () => {
      await invoke({
        method: "GET",
        url: "https://api.example.com/x",
        headers: {"X-Trace": "abc"},
      });
      const headers = lastInit().headers as Record<string, string>;
      expect(headers.Accept).toBe("application/json");
      expect(headers["X-Trace"]).toBe("abc");
    });
  });

  describe("timeouts", () => {
    it("defaults to 30s, honours a shorter request timeout, and caps at 60s", async () => {
      const timeoutSpy = vi.spyOn(AbortSignal, "timeout");

      await invoke({method: "GET", url: "https://api.example.com/x"});
      expect(timeoutSpy).toHaveBeenLastCalledWith(30_000);

      await invoke({method: "GET", url: "https://api.example.com/x", timeoutMs: 5_000});
      expect(timeoutSpy).toHaveBeenLastCalledWith(5_000);

      await invoke({method: "GET", url: "https://api.example.com/x", timeoutMs: 600_000});
      expect(timeoutSpy).toHaveBeenLastCalledWith(60_000);
    });
  });

  describe("response shaping", () => {
    it("parses a JSON response body", async () => {
      fetchMock.mockImplementation(async () => jsonResponse({items: [1, 2]}));
      const reply = await invoke({method: "GET", url: "https://api.example.com/x"});
      expect(reply.status).toBe(200);
      expect(reply.body).toEqual({items: [1, 2]});
    });

    it("returns a non-JSON body as raw text", async () => {
      fetchMock.mockImplementation(async () => new Response("plain text", {status: 200}));
      const reply = await invoke({method: "GET", url: "https://api.example.com/x"});
      expect(reply.body).toBe("plain text");
    });

    it("returns an empty string for an empty body", async () => {
      fetchMock.mockImplementation(async () => new Response("", {status: 200}));
      const reply = await invoke({method: "GET", url: "https://api.example.com/x"});
      expect(reply.body).toBe("");
    });

    it("echoes the response headers", async () => {
      fetchMock.mockImplementation(async () => jsonResponse({}, 200, {"x-rate-remaining": "42"}));
      const reply = await invoke({method: "GET", url: "https://api.example.com/x"});
      expect(reply.headers["x-rate-remaining"]).toBe("42");
    });

    it("passes an upstream error status through rather than remapping it", async () => {
      fetchMock.mockImplementation(async () => jsonResponse({error: "nope"}, 429));
      const reply = await invoke({method: "GET", url: "https://api.example.com/x"});
      expect(reply.status).toBe(429);
      expect(reply.body).toEqual({error: "nope"});
    });
  });

  describe("redirects — every hop is re-validated", () => {
    it("follows a redirect to the new location", async () => {
      fetchMock
        .mockResolvedValueOnce(redirectResponse(302, "https://other.example.com/next"))
        .mockResolvedValueOnce(jsonResponse({landed: true}));

      const reply = await invoke({method: "GET", url: "https://api.example.com/x"});
      expect(reply.body).toEqual({landed: true});
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(String(fetchMock.mock.calls[1][0])).toBe("https://other.example.com/next");
    });

    it("resolves a relative location against the current url", async () => {
      fetchMock
        .mockResolvedValueOnce(redirectResponse(302, "/v2/items"))
        .mockResolvedValueOnce(jsonResponse({landed: true}));

      await invoke({method: "GET", url: "https://api.example.com/v1/items"});
      expect(String(fetchMock.mock.calls[1][0])).toBe("https://api.example.com/v2/items");
    });

    it("gives up after 5 hops with a 502", async () => {
      fetchMock.mockImplementation(async () =>
        redirectResponse(302, "https://api.example.com/loop")
      );
      const reply = await invoke({method: "GET", url: "https://api.example.com/x"});
      expect(reply.status).toBe(502);
      expect(reply.body.error).toBe("Too many redirects (max 5)");
      expect(fetchMock).toHaveBeenCalledTimes(6);
    });

    it("returns 502 for an unparseable redirect location", async () => {
      fetchMock.mockResolvedValueOnce(redirectResponse(302, "http://"));
      const reply = await invoke({method: "GET", url: "https://api.example.com/x"});
      expect(reply.status).toBe(502);
      expect(reply.body.error).toContain("Invalid redirect location");
    });

    it.each([
      ["the GZAC instance", "https://gzac.example.com/api/v1/document/1"],
      ["a private address", "https://169.254.169.254/latest/meta-data/"],
      ["plain http", "http://api.example.com/x"],
    ])("blocks a redirect into %s", async (_label, location) => {
      fetchMock.mockResolvedValueOnce(redirectResponse(302, location));
      const reply = await invoke({method: "GET", url: "https://api.example.com/x"});
      expect(reply.status).toBe(400);
      expect(reply.body.error).toContain("blocked:");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("turns a 303 into a bodyless GET", async () => {
      fetchMock
        .mockResolvedValueOnce(redirectResponse(303, "https://api.example.com/result"))
        .mockResolvedValueOnce(jsonResponse({landed: true}));

      await invoke({method: "POST", url: "https://api.example.com/x", body: {a: 1}});
      const init = fetchMock.mock.calls[1][1] as Record<string, unknown>;
      expect(init.method).toBe("GET");
      expect(init.body).toBeUndefined();
    });

    it.each([301, 302])("turns a %d on a body-bearing method into a bodyless GET", async (status) => {
      fetchMock
        .mockResolvedValueOnce(redirectResponse(status, "https://api.example.com/moved"))
        .mockResolvedValueOnce(jsonResponse({landed: true}));

      await invoke({method: "POST", url: "https://api.example.com/x", body: {a: 1}});
      const init = fetchMock.mock.calls[1][1] as Record<string, unknown>;
      expect(init.method).toBe("GET");
      expect(init.body).toBeUndefined();
    });

    it.each([307, 308])("preserves method and body across a %d", async (status) => {
      fetchMock
        .mockResolvedValueOnce(redirectResponse(status, "https://api.example.com/moved"))
        .mockResolvedValueOnce(jsonResponse({landed: true}));

      await invoke({method: "POST", url: "https://api.example.com/x", body: {a: 1}});
      const init = fetchMock.mock.calls[1][1] as Record<string, unknown>;
      expect(init.method).toBe("POST");
      expect(init.body).toBe('{"a":1}');
    });

    it("strips credential headers when a hop crosses origins", async () => {
      fetchMock
        .mockResolvedValueOnce(redirectResponse(307, "https://elsewhere.example.com/next"))
        .mockResolvedValueOnce(jsonResponse({landed: true}));

      await invoke({
        method: "GET",
        url: "https://api.example.com/x",
        headers: {
          Authorization: "Bearer plugin-supplied",
          Cookie: "session=1",
          "Proxy-Authorization": "Basic abc",
          "X-Trace": "keep-me",
        },
      });

      const headers = fetchMock.mock.calls[1][1].headers as Record<string, string>;
      expect(headers.Authorization).toBeUndefined();
      expect(headers.Cookie).toBeUndefined();
      expect(headers["Proxy-Authorization"]).toBeUndefined();
      expect(headers["X-Trace"]).toBe("keep-me");
    });

    it("keeps credential headers on a same-origin hop", async () => {
      fetchMock
        .mockResolvedValueOnce(redirectResponse(307, "https://api.example.com/next"))
        .mockResolvedValueOnce(jsonResponse({landed: true}));

      await invoke({
        method: "GET",
        url: "https://api.example.com/x",
        headers: {Authorization: "Bearer plugin-supplied"},
      });

      const headers = fetchMock.mock.calls[1][1].headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer plugin-supplied");
    });
  });

  describe("audit logging (plugin_logs, source http_request)", () => {
    it("persists one redacted record per successful call", async () => {
      fetchMock.mockImplementation(async () => jsonResponse({}, 201));
      const {repo, insert} = logRepoDouble();

      await invoke(
        {method: "get", url: "https://api.example.com/v1/items?token=SECRET"},
        {logRepository: repo}
      );

      expect(insert).toHaveBeenCalledTimes(1);
      const entry = insert.mock.calls[0][0];
      expect(entry).toMatchObject({
        configurationId: "cfg-1",
        pluginId: "case-summary",
        pluginVersion: "0.1.0",
        level: "info",
        source: "http_request",
      });
      expect(entry.message).toBe("GET https://api.example.com/v1/items → 201");
      expect(entry.message).not.toContain("SECRET");
      expect(entry.data).toMatchObject({
        method: "get",
        url: "https://api.example.com/v1/items",
        status: 201,
      });
      expect(typeof entry.data.durationMs).toBe("number");
    });

    it("persists an error record when the call fails", async () => {
      fetchMock.mockRejectedValue(new Error("fetch failed", {cause: new Error("ECONNREFUSED")}));
      const {repo, insert} = logRepoDouble();

      await invoke({method: "GET", url: "https://api.example.com/x"}, {logRepository: repo});

      expect(insert).toHaveBeenCalledTimes(1);
      expect(insert.mock.calls[0][0]).toMatchObject({level: "error", source: "http_request"});
      expect(insert.mock.calls[0][0].message).toContain("ECONNREFUSED");
    });

    it("does not fail the call — or leak an unhandled rejection — when persisting the log fails", async () => {
      const {repo, insert} = logRepoDouble(async () => {
        throw new Error("db down");
      });

      const reply = await invoke({method: "GET", url: "https://api.example.com/x"}, {
        logRepository: repo,
      });

      expect(reply.status).toBe(200);
      expect(insert).toHaveBeenCalledTimes(1);
      // Let the rejected insert promise settle; an unguarded .catch would surface here.
      await new Promise((resolve) => setImmediate(resolve));
    });
  });

  describe("failure mapping", () => {
    it("maps a fetch failure to 502 with the root cause message", async () => {
      fetchMock.mockRejectedValue(
        new Error("fetch failed", {cause: new Error("ECONNREFUSED 1.2.3.4:443")})
      );
      const reply = await invoke({method: "GET", url: "https://api.example.com/x"});
      expect(reply.status).toBe(502);
      expect(reply.body.error).toBe("http_request failed: ECONNREFUSED 1.2.3.4:443");
    });

    it("maps the guarded agent's private-address rejection to a 400 policy error, not a 502", async () => {
      const blocked: NodeJS.ErrnoException = new Error(
        "Hostname 'internal.example.com' resolves to 10.0.0.5, which is in a private or reserved range"
      );
      blocked.code = "EPRIVATEADDRESS";
      fetchMock.mockRejectedValue(new Error("fetch failed", {cause: blocked}));

      const reply = await invoke({method: "GET", url: "https://internal.example.com/x"});
      expect(reply.status).toBe(400);
      expect(reply.body.error).toContain("private or reserved range");
      expect(reply.body.error).toContain("HOST_ALLOW_PRIVATE_NETWORK=true");
    });

    it("maps an abort (timeout) to 502 with the abort reason", async () => {
      fetchMock.mockRejectedValue(
        Object.assign(new Error("This operation was aborted"), {name: "AbortError"})
      );
      const reply = await invoke({method: "GET", url: "https://api.example.com/x"});
      expect(reply.status).toBe(502);
      expect(reply.body.error).toContain("aborted");
    });
  });
});
