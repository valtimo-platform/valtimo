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
import {antPatternToRegExp, isEndpointAllowed} from "./endpoint-allowlist";

describe("antPatternToRegExp", () => {
  it("matches a literal pattern exactly", () => {
    const re = antPatternToRegExp("/api/v1/document");
    expect(re.test("/api/v1/document")).toBe(true);
    expect(re.test("/api/v1/documents")).toBe(false);
    expect(re.test("/api/v1/document/123")).toBe(false);
  });

  it("lets * span one segment but never a slash", () => {
    const re = antPatternToRegExp("/api/v1/document/*");
    expect(re.test("/api/v1/document/123")).toBe(true);
    expect(re.test("/api/v1/document/")).toBe(true);
    expect(re.test("/api/v1/document/123/note")).toBe(false);
  });

  it("supports * inside a segment", () => {
    const re = antPatternToRegExp("/api/v1/document/*/note");
    expect(re.test("/api/v1/document/123/note")).toBe(true);
    expect(re.test("/api/v1/document/123/456/note")).toBe(false);
  });

  it("lets ** span multiple segments, including none for a trailing /**", () => {
    const re = antPatternToRegExp("/api/v1/case/**");
    expect(re.test("/api/v1/case")).toBe(true);
    expect(re.test("/api/v1/case/x")).toBe(true);
    expect(re.test("/api/v1/case/x/search")).toBe(true);
    expect(re.test("/api/v1/cases")).toBe(false);
  });

  it("escapes regex metacharacters in the pattern", () => {
    const re = antPatternToRegExp("/api/v1.0/foo");
    expect(re.test("/api/v1.0/foo")).toBe(true);
    expect(re.test("/api/v1x0/foo")).toBe(false);
  });
});

describe("isEndpointAllowed", () => {
  const endpoints = [
    { method: "GET", pattern: "/api/v1/document/*" },
    { method: "POST", pattern: "/api/v1/case/**" },
  ];

  it("requires both the method and the pattern to match", () => {
    expect(isEndpointAllowed("GET", "/api/v1/document/1", endpoints)).toBe(true);
    expect(isEndpointAllowed("POST", "/api/v1/document/1", endpoints)).toBe(false);
    expect(isEndpointAllowed("GET", "/api/v1/case/x/search", endpoints)).toBe(false);
    expect(isEndpointAllowed("POST", "/api/v1/case/x/search", endpoints)).toBe(true);
  });

  it("matches the method case-insensitively and supports a wildcard method", () => {
    expect(isEndpointAllowed("get", "/api/v1/document/1", endpoints)).toBe(true);
    expect(isEndpointAllowed("DELETE", "/x", [{ method: "*", pattern: "/**" }])).toBe(true);
  });

  it("ignores the query string when matching", () => {
    expect(isEndpointAllowed("GET", "/api/v1/document/1?full=true", endpoints)).toBe(true);
  });

  it("denies everything for an empty list", () => {
    expect(isEndpointAllowed("GET", "/api/v1/document/1", [])).toBe(false);
  });
});
