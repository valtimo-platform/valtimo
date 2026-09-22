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

/**
 * L1 tests for the `gzac_api` path canonicaliser. The property that matters is agreement: whatever
 * this returns is both what the endpoint allowlist is checked against and what is actually
 * requested, so a path that resolves elsewhere during URL parsing can never sneak past a grant.
 */

import {describe, expect, it} from "vitest";
import {normalizeGzacApiPath} from "./request-path";

/** The path a WHATWG-URL-parsing `fetch` would really request for this input. */
function whatFetchWouldRequest(path: string): string {
  const url = new URL(`http://gzac.invalid${path}`);
  return `${url.pathname}${url.search}${url.hash}`;
}

describe("normalizeGzacApiPath", () => {
  describe("canonicalisation", () => {
    it.each([
      ["resolves dot segments", "/api/v1/document/../../../v1/case/123", "/v1/case/123"],
      ["resolves a single dot segment", "/api/./v1/x", "/api/v1/x"],
      ["collapses duplicate slashes", "/api//v1/x", "/api/v1/x"],
      ["keeps a trailing slash", "/api/v1/x/", "/api/v1/x/"],
      ["keeps a plain path unchanged", "/api/v1/document/123", "/api/v1/document/123"],
      ["keeps the query verbatim", "/api/v1/x?q=../y", "/api/v1/x?q=../y"],
      ["normalises the path but not the query", "/api//v1/x?a=b//c", "/api/v1/x?a=b//c"],
      ["keeps a fragment verbatim", "/api/v1/x#../frag", "/api/v1/x#../frag"],
      ["keeps a query that contains a '#'", "/api/v1/x?q=a#b", "/api/v1/x?q=a#b"],
      ["resolves a dot segment before a query", "/api/v1/a/../b?q=1", "/api/v1/b?q=1"],
    ])("%s", (_label, input, expected) => {
      expect(normalizeGzacApiPath(input)).toEqual({ ok: true, path: expected });
    });

    it("returns the same path fetch would request, for every accepted input", () => {
      // This is the whole point of the module: the checked string and the requested string agree.
      const inputs = [
        "/api/v1/document/../../../v1/case/123",
        "/api/./v1/x",
        "/api//v1/x",
        "/api/v1/x/",
        "/api/v1/document/123",
        "/api/v1/a/../b?q=1",
      ];
      for (const input of inputs) {
        const result = normalizeGzacApiPath(input);
        expect(result.ok).toBe(true);
        if (!result.ok) continue;
        expect(whatFetchWouldRequest(result.path)).toBe(result.path);
      }
    });
  });

  describe("refusals", () => {
    it.each([
      ["a percent-encoded traversal", "/api/v1/%2e%2e%2fadmin"],
      ["an upper-case percent-encoded traversal", "/api/v1/%2E%2E/admin"],
      ["a percent-encoded slash", "/api/v1/a%2Fb"],
      ["a percent-encoded backslash", "/api/v1/a%5Cb"],
    ])("refuses %s rather than guessing how often to decode", (_label, input) => {
      const result = normalizeGzacApiPath(input);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toContain("percent-encoded");
    });

    it("refuses a backslash, which some servers treat as a separator", () => {
      const result = normalizeGzacApiPath("/api/v1\\..\\admin");
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toContain("backslash");
    });

    it.each([
      ["a path escaping above the root", "/../x"],
      ["a path escaping above the root mid-way", "/api/../../x"],
    ])("refuses %s rather than silently clamping it to the root", (_label, input) => {
      // Both `posix.normalize` and the URL parser would quietly turn these into `/x`; refusing keeps
      // a nonsense request from becoming a valid-looking one.
      const result = normalizeGzacApiPath(input);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toContain("escapes the API root");
    });

    it.each([
      ["a relative path", "../x"],
      ["a path without a leading slash", "api/v1/x"],
    ])("refuses %s", (_label, input) => {
      const result = normalizeGzacApiPath(input);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toContain("must start with '/'");
    });

    it.each([
      ["undefined", undefined],
      ["null", null],
      ["a number", 42],
      ["an object", { path: "/api/v1/x" }],
      ["an empty string", ""],
    ])("refuses %s as a path", (_label, input) => {
      const result = normalizeGzacApiPath(input);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toContain("non-empty string");
    });

    it("checks the path portion only — an encoded separator in the query is fine", () => {
      expect(normalizeGzacApiPath("/api/v1/x?redirect=%2Fhome")).toEqual({
        ok: true,
        path: "/api/v1/x?redirect=%2Fhome",
      });
    });
  });
});
