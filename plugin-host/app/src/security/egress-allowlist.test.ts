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
import {describeAllowedEgress, findEgressViolation} from "./egress-allowlist";

/**
 * The origin allowlist for `http_request`. This is the gate that makes outbound HTTP deny-by-default,
 * bringing the Wasm half of a plugin in line with the `connect-src 'self'` its iframe half already
 * runs under. Every case here goes through a real `URL`, because that is the only form the host ever
 * sees — `validateTarget` is handed a parsed URL, never a raw string.
 */
describe("findEgressViolation", () => {
  const allow = (raw: string, entries: string[] | undefined) =>
    findEgressViolation(new URL(raw), entries) === null;

  describe("deny by default", () => {
    it.each([
      ["an empty list — pushed, nothing granted", []],
      ["an absent list — a push that carried no allowlist at all", undefined],
    ])("refuses every destination for %s", (_label, entries) => {
      expect(allow("https://api.example.com/x", entries as string[] | undefined)).toBe(false);
    });

    it("names the two declaration sources so the reason is actionable", () => {
      const reason = findEgressViolation(new URL("https://api.example.com/x"), []);
      expect(reason).toContain("permissions.egress");
      expect(reason).toContain("x-egress-target");
    });

    it("lists the granted origins when the allowlist is non-empty but does not match", () => {
      const reason = findEgressViolation(new URL("https://attacker.example.com/x"), ["api.kvk.nl"]);
      expect(reason).toContain("attacker.example.com");
      expect(reason).toContain("https://api.kvk.nl:443");
    });
  });

  describe("origin matching", () => {
    it("accepts a scheme-less entry as https on the default port", () => {
      expect(allow("https://api.kvk.nl/v1/basisprofielen", ["api.kvk.nl"])).toBe(true);
      expect(allow("https://api.kvk.nl:443/v1", ["api.kvk.nl"])).toBe(true);
    });

    it("refuses an http downgrade against a scheme-less entry", () => {
      // The reason origins are matched rather than hostnames: with HOST_ALLOW_HTTP=true a
      // hostname-only allowlist would permit this.
      expect(allow("http://api.kvk.nl/v1", ["api.kvk.nl"])).toBe(false);
      expect(allow("http://api.kvk.nl/v1", ["http://api.kvk.nl"])).toBe(true);
    });

    it("treats a missing port as the default port, not as any port", () => {
      expect(allow("https://sd.internal:9200/_search", ["sd.internal"])).toBe(false);
      expect(allow("https://sd.internal:8443/api", ["https://sd.internal:8443"])).toBe(true);
      expect(allow("https://sd.internal/api", ["https://sd.internal:8443"])).toBe(false);
    });

    it("ignores the path, query and fragment of the requested URL", () => {
      expect(allow("https://api.kvk.nl/v1/x?y=1#z", ["api.kvk.nl"])).toBe(true);
    });

    it("matches host names case-insensitively", () => {
      expect(allow("https://API.KVK.NL/v1", ["api.kvk.nl"])).toBe(true);
    });

    it("accepts any of several entries", () => {
      const entries = ["api.kvk.nl", "https://sd.acme-acc.internal:8443"];
      expect(allow("https://sd.acme-acc.internal:8443/doc", entries)).toBe(true);
      expect(allow("https://api.kvk.nl/v1", entries)).toBe(true);
      expect(allow("https://other.example.com/v1", entries)).toBe(false);
    });

    it("does not treat a suffix of a granted host as granted", () => {
      // `evil-api.kvk.nl.attacker.com` ends with neither the host nor a dot-prefixed suffix of it.
      expect(allow("https://api.kvk.nl.attacker.com/x", ["api.kvk.nl"])).toBe(false);
      expect(allow("https://notapi.kvk.nl/x", ["api.kvk.nl"])).toBe(false);
    });
  });

  describe("wildcards", () => {
    it("covers exactly one label — not the apex, not a deeper name", () => {
      expect(allow("https://acct.blob.core.windows.net/c", ["*.blob.core.windows.net"])).toBe(true);
      expect(allow("https://blob.core.windows.net/c", ["*.blob.core.windows.net"])).toBe(false);
      expect(allow("https://a.b.blob.core.windows.net/c", ["*.blob.core.windows.net"])).toBe(false);
    });

    it("still enforces scheme and port", () => {
      expect(allow("http://api.vendor.com/x", ["*.vendor.com"])).toBe(false);
      expect(allow("https://api.vendor.com:8443/x", ["*.vendor.com"])).toBe(false);
    });

    it("ignores an entry too broad to be a real grant", () => {
      // `*.com` and a bare `*` never normalise, so they contribute nothing rather than everything.
      for (const entry of ["*", "*.com", "https://*"]) {
        expect(allow("https://anything.com/x", [entry])).toBe(false);
      }
    });
  });

  describe("malformed entries", () => {
    it.each([
      ["an unparseable entry", "not a host name at all"],
      ["a non-http scheme", "ftp://files.example.com"],
      ["an entry carrying credentials", "https://user:pass@api.example.com"],
      ["an entry narrowed by a path", "https://api.example.com/v1"],
      ["an empty entry", "   "],
    ])("contributes nothing for %s", (_label, entry) => {
      expect(allow("https://api.example.com/v1", [entry])).toBe(false);
    });

    it("does not let a malformed entry disable the entries beside it", () => {
      expect(allow("https://api.kvk.nl/v1", ["not a url", "api.kvk.nl"])).toBe(true);
    });
  });

  describe("describeAllowedEgress", () => {
    it("canonicalises entries so the diagnostic shows what is actually enforced", () => {
      expect(describeAllowedEgress(["api.kvk.nl", "https://sd.internal:8443"])).toBe(
        "https://api.kvk.nl:443, https://sd.internal:8443"
      );
    });

    it("shows an unusable entry verbatim rather than dropping it from the diagnostic", () => {
      expect(describeAllowedEgress(["*.com"])).toBe("*.com");
    });
  });
});
