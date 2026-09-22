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

import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import type {FastifyInstance} from "fastify";
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {buildTestApp} from "../test-support/harness";
import {pluginBundleRoutes} from "./plugin-bundles";

const PLUGIN = "case-summary";
const VERSION = "0.1.0";
const PACKAGE_HASH = "sha256:aaaa1111";

describe("plugin-bundles routes", () => {
  let pluginDir: string;
  let app: FastifyInstance;
  let pluginManager: {
    getManifest: ReturnType<typeof vi.fn>;
    getPluginDir: ReturnType<typeof vi.fn>;
    getContentHash: ReturnType<typeof vi.fn>;
  };

  beforeAll(() => {
    pluginDir = mkdtempSync(join(tmpdir(), "plugin-bundles-"));
    mkdirSync(join(pluginDir, "frontend"), { recursive: true });
    writeFileSync(join(pluginDir, "frontend", "case-tab.bundle.js"), "console.log('bundle');");
    writeFileSync(join(pluginDir, "logo.svg"), "<svg/>");
    writeFileSync(join(pluginDir, "secret.txt"), "top secret"); // outside frontend/, for traversal test
  });

  afterAll(() => {
    rmSync(pluginDir, { recursive: true, force: true });
  });

  // Origins the stub registry reports as allowed to frame. Read per request, so a test can change
  // the allowlist without rebuilding the app — which is also how the real registry behaves once its
  // short-TTL cache expires.
  let allowedOrigins: string[];

  beforeEach(async () => {
    allowedOrigins = ["https://valtimo.example.com"];
    pluginManager = {
      getManifest: vi.fn(() => ({ logo: "logo.svg" })),
      getPluginDir: vi.fn(() => pluginDir),
      // Recomputed by the manager on every install, so a re-upload of the same version reports a
      // different hash — that is what the cache validator hangs off.
      getContentHash: vi.fn(() => PACKAGE_HASH),
    };
    const frameAncestorRegistry = {
      allowedOrigins: async () => allowedOrigins,
      isAllowed: async (origin: string) => allowedOrigins.includes(origin),
    };
    app = await buildTestApp((a) =>
      pluginBundleRoutes(a, { pluginManager: pluginManager as never, frameAncestorRegistry })
    );
  });

  afterEach(async () => {
    await app.close();
  });

  describe("bundles/*", () => {
    it("serves a frontend file with its content-type and permissive CORS", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/plugins/${PLUGIN}/${VERSION}/bundles/case-tab.bundle.js`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toBe("application/javascript");
      expect(res.headers["access-control-allow-origin"]).toBe("*");
      expect(res.body).toContain("console.log('bundle')");
    });

    it("serves every bundle with a strict anti-exfiltration CSP", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/plugins/${PLUGIN}/${VERSION}/bundles/case-tab.bundle.js`,
      });
      const csp = res.headers["content-security-policy"] as string;
      expect(csp).toContain("default-src 'none'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("connect-src 'self'");
      expect(csp).toContain("form-action 'self'");
      expect(csp).toContain("sandbox allow-scripts allow-forms");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["referrer-policy"]).toBe("no-referrer");
    });

    it("blocks a path-traversal attempt with 403", async () => {
      // %2e%2e%2f decodes to ../ — an attempt to escape the frontend/ directory to reach secret.txt.
      const res = await app.inject({
        method: "GET",
        url: `/plugins/${PLUGIN}/${VERSION}/bundles/%2e%2e%2fsecret.txt`,
      });
      expect(res.statusCode).toBe(403);
    });

    it("returns 404 for a file that does not exist", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/plugins/${PLUGIN}/${VERSION}/bundles/missing.js`,
      });
      expect(res.statusCode).toBe(404);
    });

    it("returns 404 when the plugin is not loaded", async () => {
      pluginManager.getManifest.mockReturnValueOnce(null);
      const res = await app.inject({
        method: "GET",
        url: `/plugins/${PLUGIN}/${VERSION}/bundles/case-tab.bundle.js`,
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("logo", () => {
    it("serves the declared logo with the right content-type", async () => {
      const res = await app.inject({ method: "GET", url: `/plugins/${PLUGIN}/${VERSION}/logo` });
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toBe("image/svg+xml");
      expect(res.headers["access-control-allow-origin"]).toBe("*");
      // Plugin-authored content: same CSP as the bundles (an SVG can carry script).
      expect(res.headers["content-security-policy"]).toContain("script-src 'self'");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
    });

    it("returns 404 when the manifest declares no logo", async () => {
      pluginManager.getManifest.mockReturnValueOnce({});
      const res = await app.inject({ method: "GET", url: `/plugins/${PLUGIN}/${VERSION}/logo` });
      expect(res.statusCode).toBe(404);
    });

    it("returns 404 when the declared logo is missing on disk", async () => {
      pluginManager.getManifest.mockReturnValueOnce({ logo: "ghost.svg" });
      const res = await app.inject({ method: "GET", url: `/plugins/${PLUGIN}/${VERSION}/logo` });
      expect(res.statusCode).toBe(404);
    });
  });

  /**
   * A plugin version can be re-uploaded in place (`overwrite=true`), which changes the bytes without
   * changing the URL. The validator has to be derived from the content for that to be visible to a
   * browser — a TTL would keep serving the superseded bundle, and the URL cannot be cache-busted
   * from outside because a bundle's HTML references its script by a bare relative path.
   */
  describe("caching", () => {
    const bundleUrl = `/plugins/${PLUGIN}/${VERSION}/bundles/case-tab.bundle.js`;
    const logoUrl = `/plugins/${PLUGIN}/${VERSION}/logo`;

    it("requires revalidation and sends a validator on both the bundle and the logo", async () => {
      for (const url of [bundleUrl, logoUrl]) {
        const res = await app.inject({ method: "GET", url });
        expect(res.statusCode).toBe(200);
        expect(res.headers["cache-control"]).toBe("public, no-cache");
        expect(res.headers["etag"]).toBe(`"${PACKAGE_HASH}"`);
      }
    });

    it("answers 304 with no body when the client already has the current entity", async () => {
      const first = await app.inject({ method: "GET", url: bundleUrl });
      const etag = first.headers["etag"] as string;

      const second = await app.inject({
        method: "GET",
        url: bundleUrl,
        headers: { "if-none-match": etag },
      });

      expect(second.statusCode).toBe(304);
      expect(second.body).toBe("");
      // Kept on the 304 so a cache that revalidates repeatedly retains a usable entry.
      expect(second.headers["etag"]).toBe(etag);
    });

    /**
     * The validator is the package hash, not a digest of the response body — so revalidating an
     * unchanged bundle never opens the file. Asserting the value is how this test pins that down:
     * a body-derived validator could not equal the hash the manager reports.
     */
    it("derives the validator from the package hash rather than the bytes", async () => {
      const res = await app.inject({ method: "GET", url: bundleUrl });

      expect(res.headers["etag"]).toBe(`"${PACKAGE_HASH}"`);
      expect(pluginManager.getContentHash).toHaveBeenCalledWith(PLUGIN, VERSION);
    });

    it("serves the new bytes with a new validator after the version is overwritten in place", async () => {
      const before = await app.inject({ method: "GET", url: bundleUrl });
      const staleEtag = before.headers["etag"] as string;

      // Same plugin, same version, same URL — an overwrite replaced the package, so the manager
      // reports the hash of the new content.
      writeFileSync(join(pluginDir, "frontend", "case-tab.bundle.js"), "console.log('v2');");
      pluginManager.getContentHash.mockReturnValue("sha256:bbbb2222");

      const revalidated = await app.inject({
        method: "GET",
        url: bundleUrl,
        headers: { "if-none-match": staleEtag },
      });

      expect(revalidated.statusCode).toBe(200);
      expect(revalidated.body).toContain("v2");
      expect(revalidated.headers["etag"]).toBe('"sha256:bbbb2222"');

      writeFileSync(join(pluginDir, "frontend", "case-tab.bundle.js"), "console.log('bundle');");
    });

    /**
     * The hash is not optional on a loaded plugin, so it is missing only when the version is gone
     * from the manager — which is what the manifest check reports as a 404. Serving the file with
     * no validator, or hashing its bytes to invent one, would both be answers to a question that
     * has already been settled: this version is no longer loaded.
     */
    it("404s rather than serving unvalidated content when the version is not loaded", async () => {
      pluginManager.getContentHash.mockReturnValue(null);

      for (const url of [bundleUrl, logoUrl]) {
        const res = await app.inject({ method: "GET", url });
        expect(res.statusCode).toBe(404);
      }
    });

    it("accepts the list form, the weak prefix and the wildcard in If-None-Match", async () => {
      const etag = (await app.inject({ method: "GET", url: bundleUrl })).headers["etag"] as string;

      for (const header of [`"other", ${etag}`, `W/${etag}`, "*"]) {
        const res = await app.inject({
          method: "GET",
          url: bundleUrl,
          headers: { "if-none-match": header },
        });
        expect(res.statusCode).toBe(304);
      }
    });

    it("serves the body when If-None-Match names a different entity", async () => {
      const res = await app.inject({
        method: "GET",
        url: bundleUrl,
        headers: { "if-none-match": '"not-the-current-entity"' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toContain("console.log('bundle')");
    });
  });

  /**
   * The gate that stops an attacker-controlled page from framing a plugin and answering its
   * proxied calls with fabricated data. The browser enforces it, so the only thing the host has to
   * get right is which origins end up in the directive — and that nothing may frame it when the
   * allowlist is empty.
   */
  describe("frame-ancestors", () => {
    const bundleUrl = `/plugins/${PLUGIN}/${VERSION}/bundles/case-tab.bundle.js`;
    const logoUrl = `/plugins/${PLUGIN}/${VERSION}/logo`;

    it("lists every registered origin on both the bundle and the logo", async () => {
      allowedOrigins = ["https://valtimo.example.com", "http://localhost:4200"];

      for (const url of [bundleUrl, logoUrl]) {
        const res = await app.inject({ method: "GET", url });
        expect(res.headers["content-security-policy"]).toContain(
          "frame-ancestors https://valtimo.example.com http://localhost:4200"
        );
        // The legitimate embed must not be broken by the older header, which has no allowlist form.
        expect(res.headers["x-frame-options"]).toBeUndefined();
      }
    });

    it("fails closed with 'none' and X-Frame-Options when no origin is registered", async () => {
      allowedOrigins = [];

      for (const url of [bundleUrl, logoUrl]) {
        const res = await app.inject({ method: "GET", url });
        expect(res.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
        expect(res.headers["x-frame-options"]).toBe("DENY");
      }
    });

    it("keeps the anti-exfiltration directives alongside frame-ancestors", async () => {
      const csp = (await app.inject({ method: "GET", url: bundleUrl })).headers[
        "content-security-policy"
      ] as string;

      expect(csp).toContain("default-src 'none'");
      expect(csp).toContain("connect-src 'self'");
      expect(csp).toContain("sandbox allow-scripts allow-forms");
      expect(csp).toContain("frame-ancestors https://valtimo.example.com");
    });
  });

  describe("frame-policy probe", () => {
    const policyUrl = `/plugins/${PLUGIN}/${VERSION}/frame-policy`;

    it("answers true for a registered origin and false for anything else", async () => {
      const allowed = await app.inject({
        method: "GET",
        url: `${policyUrl}?origin=${encodeURIComponent("https://valtimo.example.com")}`,
      });
      expect(allowed.statusCode).toBe(200);
      expect(allowed.json()).toEqual({ allowed: true });

      const denied = await app.inject({
        method: "GET",
        url: `${policyUrl}?origin=${encodeURIComponent("https://evil.example")}`,
      });
      expect(denied.json()).toEqual({ allowed: false });
    });

    it("never enumerates the registered origins — the caller must name the one it asks about", async () => {
      const res = await app.inject({ method: "GET", url: policyUrl });

      expect(res.json()).toEqual({ allowed: false });
      expect(res.body).not.toContain("valtimo.example.com");
    });

    it("is reachable from the iframe's opaque origin", async () => {
      const res = await app.inject({
        method: "GET",
        url: `${policyUrl}?origin=${encodeURIComponent("https://valtimo.example.com")}`,
        headers: { origin: "null" },
      });

      expect(res.headers["access-control-allow-origin"]).toBe("*");
      expect(res.headers["cache-control"]).toBe("no-store");
    });

    it("returns 404 for a plugin that is not loaded", async () => {
      pluginManager.getManifest.mockReturnValueOnce(null);
      const res = await app.inject({ method: "GET", url: `${policyUrl}?origin=https://x.example` });
      expect(res.statusCode).toBe(404);
    });
  });
});
