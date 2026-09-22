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

import {describe, expect, it, vi} from "vitest";
import {action, getActionHandler, getRegisteredActionKeys} from "./actions";
import {getEventHandlers, onEvent} from "./events";
import {
  getRegisteredRequestPaths,
  getRequestHandler,
  onRequest,
  request,
} from "./requests";
import {getRegisteredSubmitKeys, getSubmitHandler, submit} from "./submit";
import {config, setCurrentConfig} from "./config";

/**
 * The handler registries a plugin author writes against. `runtime.ts` looks handlers up
 * here on every Wasm invocation, so registration semantics — last-registration-wins, the request
 * catch-all fallback, multiple event handlers — decide what a shipped plugin actually dispatches.
 * Module state is shared across a file, so each block registers its own keys.
 */
describe("action registry", () => {
  it("registers a handler under its key and looks it up", () => {
    const handler = vi.fn(() => ({status: "completed" as const}));
    action("summarize", handler);

    expect(getActionHandler("summarize")).toBe(handler);
    expect(getRegisteredActionKeys()).toContain("summarize");
  });

  it("returns undefined for an unregistered key (the runtime's UNKNOWN_ACTION path)", () => {
    expect(getActionHandler("never-registered")).toBeUndefined();
  });

  it("lets a later registration replace an earlier one for the same key", () => {
    const first = vi.fn(() => ({status: "completed" as const}));
    const second = vi.fn(() => ({status: "completed" as const}));
    action("duplicate", first);
    action("duplicate", second);

    expect(getActionHandler("duplicate")).toBe(second);
    expect(getRegisteredActionKeys().filter((k) => k === "duplicate")).toHaveLength(1);
  });
});

describe("event registry", () => {
  it("collects every registered handler — all of them run per event", () => {
    const before = getEventHandlers().length;
    const first = vi.fn(() => ({status: "completed" as const}));
    const second = vi.fn(() => ({status: "ignored" as const}));

    onEvent(first);
    onEvent(second);

    const handlers = getEventHandlers();
    expect(handlers).toHaveLength(before + 2);
    expect(handlers).toContain(first);
    expect(handlers).toContain(second);
  });
});

describe("request registry", () => {
  it("registers a handler per path", () => {
    const handler = vi.fn(() => ({status: 200}));
    request("/summary", handler);

    expect(getRequestHandler("/summary")).toBe(handler);
    expect(getRegisteredRequestPaths()).toContain("/summary");
  });

  it("falls back to the catch-all for an unmatched path, but exact paths still win", () => {
    // Asserted here, not in its own test: `onRequest` sets module-level state that nothing resets,
    // so a separate test would only pass while it happened to run before this one.
    expect(getRequestHandler("/no-such-path")).toBeUndefined();

    const exact = vi.fn(() => ({status: 200}));
    const catchAll = vi.fn(() => ({status: 404}));
    request("/exact", exact);
    onRequest(catchAll);

    expect(getRequestHandler("/exact")).toBe(exact);
    expect(getRequestHandler("/anything-else")).toBe(catchAll);
    // The catch-all is not a registered path — it never appears in the manifest-facing list.
    expect(getRegisteredRequestPaths()).not.toContain("/anything-else");
  });
});

describe("submit registry", () => {
  it("registers a hook under its bundle key", () => {
    const handler = vi.fn(() => ({status: "completed" as const}));
    submit("review", handler);

    expect(getSubmitHandler("review")).toBe(handler);
    expect(getRegisteredSubmitKeys()).toContain("review");
  });

  it("returns undefined for an unregistered key (the UNKNOWN_SUBMIT_HANDLER path)", () => {
    expect(getSubmitHandler("no-hook")).toBeUndefined();
  });
});

describe("config accessor", () => {
  it("exposes the current call's injected configuration", () => {
    setCurrentConfig({apiUrl: "https://example.com", retries: 3});

    expect(config.get("apiUrl")).toBe("https://example.com");
    expect(config.get("retries")).toBe(3);
    expect(config.getAll()).toEqual({apiUrl: "https://example.com", retries: 3});
  });

  it("returns undefined for an absent property", () => {
    setCurrentConfig({only: 1});
    expect(config.get("missing")).toBeUndefined();
  });

  it("hands out a copy, so a plugin cannot mutate the injected configuration", () => {
    setCurrentConfig({token: "secret"});
    const snapshot = config.getAll();
    snapshot.token = "tampered";

    expect(config.get("token")).toBe("secret");
  });

  it("is replaced wholesale by the next invocation's configuration", () => {
    setCurrentConfig({first: true});
    setCurrentConfig({second: true});

    expect(config.getAll()).toEqual({second: true});
  });
});
