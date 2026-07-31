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

import {existsSync} from "node:fs";
import {rm} from "node:fs/promises";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import type {FastifyInstance} from "fastify";
import AdmZip from "adm-zip";
import {afterAll, afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {buildTestApp, signHeaders, testConfig} from "../test-support/harness";
import {resetReplayCacheForTests} from "../security/hmac-auth";
import {hostManagementRoutes} from "./host-management";

const PLUGINS_PATH = "/api/host/plugins";

// The upload handler extracts into <app>/.tmp and removes it in a `finally` that runs after the
// reply is sent. Under `inject()` the worker can exit before that async cleanup finishes, so remove
// the .tmp base here (this is the only spec that uploads).
const TMP_BASE = join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".tmp");

function makeZip(manifest: unknown): Buffer {
  const zip = new AdmZip();
  zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest)));
  zip.addFile("plugin.wasm", Buffer.from([0x00, 0x61, 0x73, 0x6d])); // \0asm magic
  return zip.toBuffer();
}

function multipartBody(boundary: string, fileBuffer: Buffer): Buffer {
  const pre = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="plugin.zip"\r\n` +
      `Content-Type: application/zip\r\n\r\n`
  );
  const post = Buffer.from(`\r\n--${boundary}--\r\n`);
  return Buffer.concat([pre, fileBuffer, post]);
}

const validManifest = {
  pluginId: "case-summary",
  version: "0.1.0",
  translations: { en: { name: "Case Summary", description: "desc" } },
  actions: [],
};

describe("host-management routes", () => {
  let app: FastifyInstance;
  let pluginManager: {
    listPlugins: ReturnType<typeof vi.fn>;
    listVersions: ReturnType<typeof vi.fn>;
    getManifest: ReturnType<typeof vi.fn>;
    storeAndLoad: ReturnType<typeof vi.fn>;
    removePlugin: ReturnType<typeof vi.fn>;
  };
  let configRegistry: { listByPlugin: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    resetReplayCacheForTests();
    pluginManager = {
      listPlugins: vi.fn(() => [{ pluginId: "case-summary", version: "0.1.0" }]),
      listVersions: vi.fn(() => [{ version: "0.1.0" }]),
      getManifest: vi.fn(() => ({ pluginId: "case-summary", version: "0.1.0" })),
      storeAndLoad: vi.fn(async () => validManifest),
      removePlugin: vi.fn(async () => {}),
    };
    configRegistry = { listByPlugin: vi.fn(async () => []) };
    app = await buildTestApp((a) =>
      hostManagementRoutes(a, {
        pluginManager: pluginManager as never,
        configRegistry: configRegistry as never,
        config: testConfig(),
      })
    );
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await rm(TMP_BASE, { recursive: true, force: true }).catch(() => {});
  });

  function uploadZip(zipBuffer: Buffer, secret?: string) {
    const boundary = "----vitestboundary";
    return app.inject({
      method: "POST",
      url: PLUGINS_PATH,
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
        // The signature binds the raw file bytes (not the multipart envelope) — see deferHmac.
        ...signHeaders("POST", PLUGINS_PATH, zipBuffer, secret),
      },
      payload: multipartBody(boundary, zipBuffer),
    });
  }

  describe("GET list", () => {
    it("lists all loaded plugins", async () => {
      const res = await app.inject({ method: "GET", url: PLUGINS_PATH, headers: signHeaders("GET", PLUGINS_PATH) });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([{ pluginId: "case-summary", version: "0.1.0" }]);
    });

    it("lists versions of a single plugin", async () => {
      const path = `${PLUGINS_PATH}/case-summary`;
      const res = await app.inject({ method: "GET", url: path, headers: signHeaders("GET", path) });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([{ version: "0.1.0" }]);
    });

    it("rejects an unsigned list request with 401", async () => {
      const res = await app.inject({ method: "GET", url: PLUGINS_PATH });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("POST upload", () => {
    it("stores and loads a valid package (file-byte-bound HMAC) → 201", async () => {
      const res = await uploadZip(makeZip(validManifest));
      expect(res.statusCode).toBe(201);
      expect(res.json()).toMatchObject({ pluginId: "case-summary", version: "0.1.0" });
      expect(pluginManager.storeAndLoad).toHaveBeenCalledWith(
        "case-summary",
        "0.1.0",
        expect.any(String),
        expect.any(Buffer),
        expect.any(String),
        undefined // no logo declared
      );
    });

    it("rejects an invalid manifest with 400 and validation details", async () => {
      const res = await uploadZip(makeZip({ pluginId: "x", version: "1.0.0" })); // no translations
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: "Invalid plugin manifest" });
      expect((res.json() as { details: string[] }).details.length).toBeGreaterThan(0);
      expect(pluginManager.storeAndLoad).not.toHaveBeenCalled();
    });

    it("rejects an upload whose file bytes are not correctly signed (401)", async () => {
      const res = await uploadZip(makeZip(validManifest), "attacker-secret");
      expect(res.statusCode).toBe(401);
      expect(pluginManager.storeAndLoad).not.toHaveBeenCalled();
    });

    it("rejects a package with a zip-slip entry (../ traversal) with 400 and never loads it", async () => {
      // adm-zip's *writer* sanitizes entry names, so craft the hostile name by byte-patching the
      // finished archive (same length; filename bytes are not CRC-protected) — exactly what an
      // attacker's own zip tool would produce and what adm-zip's *reader* preserves verbatim.
      const zip = new AdmZip();
      zip.addFile("manifest.json", Buffer.from(JSON.stringify(validManifest)));
      zip.addFile("plugin.wasm", Buffer.from([0x00, 0x61, 0x73, 0x6d]));
      zip.addFile("AA/evil.txt", Buffer.from("escaped the extraction dir"));
      let raw = zip.toBuffer();
      raw = Buffer.from(raw.toString("latin1").replaceAll("AA/evil.txt", "../evil.txt"), "latin1");
      expect(new AdmZip(raw).getEntries().map((e) => e.entryName)).toContain("../evil.txt");
      const res = await uploadZip(raw);

      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: "Invalid plugin package" });
      expect(pluginManager.storeAndLoad).not.toHaveBeenCalled();
      // Nothing may have been written outside the temp extraction dir.
      const escaped = join(TMP_BASE, "evil.txt");
      expect(existsSync(escaped)).toBe(false);
    });

    it("returns 400 when no file part is present", async () => {
      const boundary = "----vitestboundary";
      const body = Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="notafile"\r\n\r\nvalue\r\n--${boundary}--\r\n`
      );
      const res = await app.inject({
        method: "POST",
        url: PLUGINS_PATH,
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
        payload: body,
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("DELETE plugin", () => {
    function del(pluginId: string, version: string) {
      const path = `${PLUGINS_PATH}/${pluginId}/${version}`;
      return app.inject({ method: "DELETE", url: path, headers: signHeaders("DELETE", path) });
    }

    it("removes a plugin with no active configurations → 204", async () => {
      configRegistry.listByPlugin.mockResolvedValueOnce([]);
      const res = await del("case-summary", "0.1.0");
      expect(res.statusCode).toBe(204);
      expect(pluginManager.removePlugin).toHaveBeenCalledWith("case-summary", "0.1.0");
    });

    it("refuses deletion with 409 and the blocking configurationIds", async () => {
      configRegistry.listByPlugin.mockResolvedValueOnce([
        { configurationId: "c1" },
        { configurationId: "c2" },
      ]);
      const res = await del("case-summary", "0.1.0");
      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ configurationIds: ["c1", "c2"] });
      expect(pluginManager.removePlugin).not.toHaveBeenCalled();
    });

    it("returns 404 for an unknown plugin version", async () => {
      pluginManager.getManifest.mockReturnValueOnce(null);
      const res = await del("case-summary", "9.9.9");
      expect(res.statusCode).toBe(404);
    });
  });
});
