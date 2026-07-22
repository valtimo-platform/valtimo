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

// @vitest-environment happy-dom

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {ValtimoPluginSDK} from "./plugin-frontend-sdk";

const MANIFEST = {
  translations: {
    en: { greeting: "Hello" },
    nl: { greeting: "Hallo" },
  },
};

interface PostedMessage {
  source: string;
  event: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  /** The targetOrigin the SDK posted to — "*" or the pinned parent origin. */
  targetOrigin: string;
}

let postedMessages: PostedMessage[];
let sdk: ValtimoPluginSDK | undefined;

/**
 * A top-level happy-dom window reports `window.parent === window`, which makes `emit()` short-circuit
 * before posting. Replace `parent` with a spy so the outgoing postMessage protocol is observable —
 * exactly the seam the real iframe uses to reach its Angular parent.
 */
function installFakeParent(): void {
  postedMessages = [];
  Object.defineProperty(window, "parent", {
    configurable: true,
    value: {
      postMessage: vi.fn((msg: Omit<PostedMessage, "targetOrigin">, targetOrigin: string) =>
        postedMessages.push({ ...msg, targetOrigin })
      ),
    },
  });
}

const PARENT_ORIGIN = "http://parent.example";

function sendFromParent(event: string, payload: unknown, origin = PARENT_ORIGIN): void {
  window.dispatchEvent(
    new MessageEvent("message", { data: { source: "valtimo-host", event, payload }, origin })
  );
}

/** Completes the init handshake, which pins the parent origin for subsequent emits. */
function initFromParent(origin = PARENT_ORIGIN): void {
  sendFromParent(
    "init",
    { context: { pluginId: "case-summary" }, accessToken: "t", theme: "g10", locale: "en" },
    origin
  );
}

function lastProxyRequest(): PostedMessage {
  const req = [...postedMessages].reverse().find((m) => m.event === "proxyRequest");
  if (!req) throw new Error("no proxyRequest was posted");
  return req;
}

beforeEach(() => {
  installFakeParent();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(MANIFEST), { status: 200 }))
  );
});

afterEach(() => {
  sdk?.destroy();
  sdk = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("parent-proxy transport", () => {
  it("emits a proxyRequest for callValtimo and resolves on the matching proxyResponse", async () => {
    sdk = new ValtimoPluginSDK();
    initFromParent();
    const promise = sdk.callValtimo("GET", "/api/v1/document/123");

    const req = lastProxyRequest();
    expect(req.source).toBe("valtimo-plugin");
    expect(req.payload).toMatchObject({ target: "gzac", method: "GET", path: "/api/v1/document/123" });

    sendFromParent("proxyResponse", {
      correlationId: req.payload.correlationId,
      status: 200,
      body: { id: "123" },
    });

    await expect(promise).resolves.toEqual({ status: 200, body: { id: "123" } });
  });

  it("rejects the pending call when the parent reports an error", async () => {
    sdk = new ValtimoPluginSDK();
    initFromParent();
    const promise = sdk.callValtimo("GET", "/api/v1/document/123");
    const req = lastProxyRequest();

    sendFromParent("proxyResponse", { correlationId: req.payload.correlationId, status: 0, error: "boom" });

    await expect(promise).rejects.toThrow("boom");
  });

  it("routes getPluginData to the plugin target with a GET and query", () => {
    sdk = new ValtimoPluginSDK();
    initFromParent();
    void sdk.getPluginData("/summary", { docId: "42" });

    const req = lastProxyRequest();
    expect(req.payload).toMatchObject({ target: "plugin", method: "GET", path: "/summary", query: { docId: "42" } });
  });

  it("keys concurrent requests by distinct correlation ids and resolves each independently", async () => {
    sdk = new ValtimoPluginSDK();
    initFromParent();
    const p1 = sdk.callValtimo("GET", "/a");
    const p2 = sdk.callValtimo("GET", "/b");

    const reqs = postedMessages.filter((m) => m.event === "proxyRequest");
    const [id1, id2] = reqs.map((r) => r.payload.correlationId);
    expect(id1).not.toBe(id2);

    // Reply out of order.
    sendFromParent("proxyResponse", { correlationId: id2, status: 200, body: "B" });
    sendFromParent("proxyResponse", { correlationId: id1, status: 200, body: "A" });

    await expect(p1).resolves.toEqual({ status: 200, body: "A" });
    await expect(p2).resolves.toEqual({ status: 200, body: "B" });
  });
});

describe("origin pinning", () => {
  it("queues data-bearing emits until init pins the parent origin, then flushes them to it — never to '*'", async () => {
    sdk = new ValtimoPluginSDK();
    const promise = sdk.callValtimo("GET", "/api/v1/document/123");

    // Nothing data-bearing may have been broadcast before the origin is known.
    expect(postedMessages.filter((m) => m.event === "proxyRequest")).toEqual([]);

    initFromParent();
    const req = lastProxyRequest();
    expect(req.targetOrigin).toBe(PARENT_ORIGIN);

    sendFromParent("proxyResponse", {
      correlationId: req.payload.correlationId,
      status: 200,
      body: { id: "123" },
    });
    await expect(promise).resolves.toEqual({ status: 200, body: { id: "123" } });
  });

  it("still sends the credential-free handshake events to '*' before init (compat)", () => {
    sdk = new ValtimoPluginSDK();
    sdk.emit("ready", {});
    sdk.emit("resize", { height: 100 });
    expect(postedMessages.map((m) => [m.event, m.targetOrigin])).toEqual([
      ["ready", "*"],
      ["resize", "*"],
    ]);
  });

  it("pins every emit to the origin of the first init and ignores messages from other origins afterwards", () => {
    sdk = new ValtimoPluginSDK();
    initFromParent();

    sdk.emit("notification", { type: "info", message: "hi" });
    expect(postedMessages.at(-1)!.targetOrigin).toBe(PARENT_ORIGIN);

    // A different origin cannot re-init or inject state once the pin exists.
    sendFromParent(
      "init",
      { context: {}, accessToken: "attacker", theme: "g10", locale: "en" },
      "http://evil.example"
    );
    sendFromParent("tokenRefresh", { accessToken: "attacker" }, "http://evil.example");
    expect(sdk.getAccessToken()).toBe("t");
  });

  it("only an init message can establish the pin — pre-init messages from any origin are ignored", () => {
    sdk = new ValtimoPluginSDK();
    sendFromParent("tokenRefresh", { accessToken: "attacker" }, "http://evil.example");
    expect(sdk.getAccessToken()).toBeNull();
  });

  describe("with an explicit parentOrigin option", () => {
    it("ignores init from any other origin entirely", () => {
      sdk = new ValtimoPluginSDK({ parentOrigin: PARENT_ORIGIN });
      initFromParent("http://evil.example");
      expect(sdk.getAccessToken()).toBeNull();

      initFromParent();
      expect(sdk.getAccessToken()).toBe("t");
    });

    it("posts every message (including the ready handshake) to the configured origin only", () => {
      sdk = new ValtimoPluginSDK({ parentOrigin: PARENT_ORIGIN });
      sdk.emit("ready", {});
      void sdk.getPluginData("/summary");
      expect(postedMessages.map((m) => m.targetOrigin)).toEqual([PARENT_ORIGIN, PARENT_ORIGIN]);
    });
  });
});

describe("token confidentiality", () => {
  it("never forwards a credential in any outgoing message, even after init supplies one", () => {
    sdk = new ValtimoPluginSDK();
    sendFromParent("init", {
      context: { pluginId: "case-summary" },
      accessToken: "SECRET-TOKEN-123",
      theme: "g10",
      locale: "en",
    });

    void sdk.callValtimo("POST", "/api/v1/case/x/search", { size: 1 });

    // The SDK stores the token for reference but must never serialise it back to the parent.
    expect(sdk.getAccessToken()).toBe("SECRET-TOKEN-123");
    expect(JSON.stringify(postedMessages)).not.toContain("SECRET-TOKEN-123");
    const req = lastProxyRequest();
    expect(req.payload).not.toHaveProperty("accessToken");
    expect(req.payload).not.toHaveProperty("token");
    expect(req.payload).not.toHaveProperty("authorization");
  });

  it("ignores inbound messages whose source is not 'valtimo-host'", () => {
    sdk = new ValtimoPluginSDK();
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { source: "evil", event: "init", payload: { accessToken: "attacker" } },
        origin: "http://evil.example",
      })
    );
    expect(sdk.getAccessToken()).toBeNull();
  });
});

describe("translations", () => {
  it("resolves t() from the active locale bucket", async () => {
    sdk = new ValtimoPluginSDK();
    sendFromParent("init", { context: {}, accessToken: "t", theme: "g10", locale: "nl" });
    await sdk.ready();
    expect(sdk.t("greeting")).toBe("Hallo");
  });

  it("falls back to the en bucket for an unknown locale", async () => {
    sdk = new ValtimoPluginSDK();
    sendFromParent("init", { context: {}, accessToken: "t", theme: "g10", locale: "fr" });
    await sdk.ready();
    expect(sdk.t("greeting")).toBe("Hello");
  });

  it("returns the key (or the provided fallback) for a missing translation", async () => {
    sdk = new ValtimoPluginSDK();
    sendFromParent("init", { context: {}, accessToken: "t", theme: "g10", locale: "en" });
    await sdk.ready();
    expect(sdk.t("missing.key")).toBe("missing.key");
    expect(sdk.t("missing.key", "Fallback")).toBe("Fallback");
  });
});

describe("event buffering & lifecycle", () => {
  it("replays a buffered event to a handler registered after it arrived", () => {
    sdk = new ValtimoPluginSDK();
    sendFromParent("init", { context: { pluginId: "p" }, accessToken: "t", theme: "g10", locale: "en" });

    const received: unknown[] = [];
    sdk.onContext((ctx) => received.push(ctx));
    expect(received).toEqual([{ pluginId: "p" }]);
  });

  it("resolves ready() via the 2s fallback when init never arrives", async () => {
    vi.useFakeTimers();
    try {
      sdk = new ValtimoPluginSDK();
      let resolved = false;
      void sdk.ready().then(() => {
        resolved = true;
      });
      await vi.advanceTimersByTimeAsync(2000);
      expect(resolved).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops handling messages after destroy()", () => {
    sdk = new ValtimoPluginSDK();
    sdk.destroy();
    sendFromParent("init", { context: {}, accessToken: "after-destroy", theme: "g10", locale: "en" });
    expect(sdk.getAccessToken()).toBeNull();
    sdk = undefined; // already destroyed; skip the afterEach destroy
  });
});
