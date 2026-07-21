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

import {readFileSync} from "node:fs";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {computeBodyHash, computeSignature, verifyHmac} from "./hmac";

interface HmacVector {
  name: string;
  method: string;
  path: string;
  timestamp: string;
  body: string;
  bodyHash: string;
  expectedSignature: string;
}

// Shared cross-language golden vectors (plan §5). expectedSignature/bodyHash were produced by an
// independent oracle (openssl), so this asserts parity with the Kotlin ExternalPluginHmacSigner
// rather than the Node implementation checking itself.
const fixture = JSON.parse(
  readFileSync(new URL("../../../test-fixtures/hmac-vectors.json", import.meta.url), "utf-8")
) as { secret: string; vectors: HmacVector[] };

const SECRET = fixture.secret;

describe("HMAC golden-vector parity (cross-language, §3.9/§5)", () => {
  it.each(fixture.vectors)("computeBodyHash matches the oracle for $name", (v) => {
    expect(computeBodyHash(Buffer.from(v.body, "utf8"))).toBe(v.bodyHash);
  });

  it.each(fixture.vectors)("computeSignature matches the oracle for $name", (v) => {
    expect(computeSignature(SECRET, v.method, v.path, v.timestamp, v.bodyHash)).toBe(
      v.expectedSignature
    );
  });

  it("upper-cases the method before signing (a lowercase method signs identically)", () => {
    const v = fixture.vectors[0];
    expect(computeSignature(SECRET, v.method.toLowerCase(), v.path, v.timestamp, v.bodyHash)).toBe(
      v.expectedSignature
    );
  });
});

describe("verifyHmac", () => {
  const v = fixture.vectors[0]; // json-push-body
  const body = () => Buffer.from(v.body, "utf8");

  beforeEach(() => {
    // Pin "now" to the vector's timestamp so a correctly-signed request is inside the drift window.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(v.timestamp));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts a correctly signed, in-window request", () => {
    const result = verifyHmac(SECRET, v.method, v.path, v.expectedSignature, v.timestamp, body());
    expect(result.valid).toBe(true);
  });

  it("rejects a missing signature header", () => {
    const result = verifyHmac(SECRET, v.method, v.path, undefined, v.timestamp, body());
    expect(result).toEqual({ valid: false, error: "Missing signature header" });
  });

  it("rejects a missing timestamp header", () => {
    const result = verifyHmac(SECRET, v.method, v.path, v.expectedSignature, undefined, body());
    expect(result).toEqual({ valid: false, error: "Missing timestamp header" });
  });

  it("rejects an unparseable timestamp", () => {
    const result = verifyHmac(SECRET, v.method, v.path, v.expectedSignature, "not-a-date", body());
    expect(result).toEqual({ valid: false, error: "Invalid timestamp format" });
  });

  it("accepts a request just inside the ±5-minute drift window", () => {
    vi.setSystemTime(new Date(Date.parse(v.timestamp) + 4 * 60_000 + 59_000));
    const result = verifyHmac(SECRET, v.method, v.path, v.expectedSignature, v.timestamp, body());
    expect(result.valid).toBe(true);
  });

  it("rejects a request just outside the ±5-minute drift window", () => {
    vi.setSystemTime(new Date(Date.parse(v.timestamp) + 5 * 60_000 + 1_000));
    const result = verifyHmac(SECRET, v.method, v.path, v.expectedSignature, v.timestamp, body());
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Timestamp drift too large/);
  });

  it("rejects a future timestamp outside the window (abs drift)", () => {
    vi.setSystemTime(new Date(Date.parse(v.timestamp) - 6 * 60_000));
    const result = verifyHmac(SECRET, v.method, v.path, v.expectedSignature, v.timestamp, body());
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Timestamp drift too large/);
  });

  it("rejects a signature made with the wrong secret", () => {
    const forged = computeSignature("wrong-secret", v.method, v.path, v.timestamp, v.bodyHash);
    const result = verifyHmac(SECRET, v.method, v.path, forged, v.timestamp, body());
    expect(result).toEqual({ valid: false, error: "Invalid signature" });
  });

  it("rejects when the body was tampered with after signing", () => {
    const tampered = Buffer.from(v.body + "X", "utf8");
    const result = verifyHmac(SECRET, v.method, v.path, v.expectedSignature, v.timestamp, tampered);
    expect(result).toEqual({ valid: false, error: "Invalid signature" });
  });

  it("rejects a signature of the wrong length before the timing-safe compare", () => {
    const result = verifyHmac(SECRET, v.method, v.path, "deadbeef", v.timestamp, body());
    expect(result).toEqual({ valid: false, error: "Invalid signature" });
  });
});
