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

describe("plugin-bundles routes", () => {
  let pluginDir: string;
  let app: FastifyInstance;
  let pluginManager: { getManifest: ReturnType<typeof vi.fn>; getPluginDir: ReturnType<typeof vi.fn> };

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

  beforeEach(async () => {
    pluginManager = {
      getManifest: vi.fn(() => ({ logo: "logo.svg" })),
      getPluginDir: vi.fn(() => pluginDir),
    };
    app = await buildTestApp((a) => pluginBundleRoutes(a, { pluginManager: pluginManager as never }));
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
});
