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
import {UserTokenIntrospector} from "./user-token-introspection";

const GZAC = "http://gzac:8080";
const INTROSPECT_URL = `${GZAC}/api/v1/external-plugin/user-token/introspect`;

function okResponse(configurationId = "cfg-1", expiresInMs = 15 * 60 * 1000): Response {
  return new Response(
    JSON.stringify({
      subject: "john@example.com",
      configurationId,
      expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
    }),
    { status: 200 }
  );
}

describe("UserTokenIntrospector", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let introspector: UserTokenIntrospector;

  beforeEach(() => {
    fetchMock = vi.fn(async () => okResponse());
    vi.stubGlobal("fetch", fetchMock);
    introspector = new UserTokenIntrospector();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("presents the token as the bearer credential to GZAC's introspect endpoint", async () => {
    const result = await introspector.introspect(GZAC, "tok-1");

    expect(result).toEqual({ kind: "valid", configurationId: "cfg-1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(INTROSPECT_URL);
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer tok-1");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("normalises a trailing slash on the GZAC base URL", async () => {
    await introspector.introspect(`${GZAC}/`, "tok-1");
    expect(fetchMock.mock.calls[0][0]).toBe(INTROSPECT_URL);
  });

  it("serves a repeated token from the cache without a second network call", async () => {
    await introspector.introspect(GZAC, "tok-1");
    const second = await introspector.introspect(GZAC, "tok-1");

    expect(second).toEqual({ kind: "valid", configurationId: "cfg-1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("caches per token — a different token triggers its own introspection", async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse("cfg-1"))
      .mockResolvedValueOnce(okResponse("cfg-2"));

    const first = await introspector.introspect(GZAC, "tok-1");
    const second = await introspector.introspect(GZAC, "tok-2");

    expect(first).toEqual({ kind: "valid", configurationId: "cfg-1" });
    expect(second).toEqual({ kind: "valid", configurationId: "cfg-2" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("re-introspects once the 60s cache window has passed", async () => {
    vi.useFakeTimers();
    await introspector.introspect(GZAC, "tok-1");

    vi.setSystemTime(Date.now() + 61_000);
    await introspector.introspect(GZAC, "tok-1");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("caps the cache window at the token's own expiry when that is sooner", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(okResponse("cfg-1", 5_000)); // token expires in 5s

    await introspector.introspect(GZAC, "tok-1");
    vi.setSystemTime(Date.now() + 6_000); // < 60s, but past the token expiry
    await introspector.introspect(GZAC, "tok-1");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("maps a 401 to invalid and does not cache the rejection", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 401 }));

    expect(await introspector.introspect(GZAC, "tok-1")).toEqual({ kind: "invalid" });
    // A retry after the rejection asks GZAC again (a freshly minted token must not stay locked out).
    expect(await introspector.introspect(GZAC, "tok-1")).toEqual({
      kind: "valid",
      configurationId: "cfg-1",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("maps a 403 to invalid", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 403 }));
    expect(await introspector.introspect(GZAC, "tok-1")).toEqual({ kind: "invalid" });
  });

  it("maps an unreachable GZAC to unavailable", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await introspector.introspect(GZAC, "tok-1")).toEqual({ kind: "unavailable" });
  });

  it("maps a timeout to unavailable", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("The operation timed out.", "TimeoutError"));
    expect(await introspector.introspect(GZAC, "tok-1")).toEqual({ kind: "unavailable" });
  });

  it("maps an unexpected 5xx to unavailable (no verdict on the token)", async () => {
    fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }));
    expect(await introspector.introspect(GZAC, "tok-1")).toEqual({ kind: "unavailable" });
  });

  it("maps a malformed 200 body to unavailable", async () => {
    fetchMock.mockResolvedValueOnce(new Response("not-json", { status: 200 }));
    expect(await introspector.introspect(GZAC, "tok-1")).toEqual({ kind: "unavailable" });

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ subject: "x" }), { status: 200 }));
    expect(await introspector.introspect(GZAC, "tok-1")).toEqual({ kind: "unavailable" });

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ configurationId: "cfg-1", expiresAt: "not-a-date" }),
        { status: 200 }
      )
    );
    expect(await introspector.introspect(GZAC, "tok-1")).toEqual({ kind: "unavailable" });
  });
});
