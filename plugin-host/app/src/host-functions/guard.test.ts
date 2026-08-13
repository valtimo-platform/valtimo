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

import {describe, expect, it} from "vitest";
import type {GzacApiCallContext} from "./gzac-api.js";
import {guardHostCall} from "./guard";

const baseCtx: GzacApiCallContext = {
  configurationId: "cfg-1",
  pluginId: "case-summary",
  pluginVersion: "0.1.0",
  serviceToken: "service-token-abc",
  gzacBaseUrl: "http://gzac:8080",
  grantedCapabilities: ["kv", "log"],
};

/**
 * Builds a fake Extism CallContext. `input === null` models Extism handing us no input block at all,
 * which the guard must default to `{}` rather than crash on.
 */
function callContextWith(ctx: GzacApiCallContext | undefined, input: string | null = "{}") {
  return {
    hostContext: () => ctx,
    read: (_addr: bigint) => (input === null ? undefined : {string: () => input}),
    store: () => 0n,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

/**
 * The shared entry guard every host function funnels through (plan §18.4): it resolves the per-call
 * host context, enforces the capability allowlist, and parses the plugin's JSON request.
 */
describe("guardHostCall", () => {
  it("returns 500 when Extism supplies no host context", () => {
    const result = guardHostCall(callContextWith(undefined), 0n, "kv");
    expect(result).toEqual({
      ok: false,
      status: 500,
      message: "No active invocation context",
    });
  });

  it("passes a granted capability through with the context and parsed request", () => {
    const result = guardHostCall<{op: string}>(
      callContextWith(baseCtx, '{"op":"get"}'),
      0n,
      "kv"
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.ctx.configurationId).toBe("cfg-1");
    expect(result.req).toEqual({op: "get"});
  });

  it("denies a capability that is not in the granted list", () => {
    const result = guardHostCall(callContextWith(baseCtx), 0n, "http_request");
    expect(result).toEqual({
      ok: false,
      status: 403,
      message: "Capability 'http_request' not granted for this configuration",
    });
  });

  it("denies every capability for an empty granted list — an empty allowlist is never 'allow all'", () => {
    const ctx = {...baseCtx, grantedCapabilities: []};
    for (const capability of ["gzac_api", "http_request", "kv", "log"]) {
      expect(guardHostCall(callContextWith(ctx), 0n, capability)).toMatchObject({
        ok: false,
        status: 403,
      });
    }
  });

  it("denies when the configuration was pushed without a capability list at all", () => {
    // No implicit grant: a push carrying no grantedCapabilities stores an empty allowlist (§18.4).
    const ctx = {...baseCtx, grantedCapabilities: undefined};
    expect(guardHostCall(callContextWith(ctx), 0n, "kv")).toMatchObject({ok: false, status: 403});
  });

  it("returns 400 naming the capability when the request JSON is unparseable", () => {
    const result = guardHostCall(callContextWith(baseCtx, "{not json"), 0n, "log");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.status).toBe(400);
    expect(result.message).toContain("Invalid log request JSON");
  });

  it("defaults the request to an empty object when there is no input block", () => {
    const result = guardHostCall(callContextWith(baseCtx, null), 0n, "kv");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.req).toEqual({});
  });
});
