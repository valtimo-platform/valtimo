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
    getContentHash: ReturnType<typeof vi.fn>;
    hasVersion: ReturnType<typeof vi.fn>;
    installPackage: ReturnType<typeof vi.fn>;
    removePlugin: ReturnType<typeof vi.fn>;
  };
  let configRegistry: { listByPlugin: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    resetReplayCacheForTests();
    pluginManager = {
      listPlugins: vi.fn(() => [{ pluginId: "case-summary", version: "0.1.0" }]),
      listVersions: vi.fn(() => [{ version: "0.1.0" }]),
      getManifest: vi.fn(() => ({ pluginId: "case-summary", version: "0.1.0" })),
      getContentHash: vi.fn(() => "sha256:abc123"),
      hasVersion: vi.fn(() => false),
      installPackage: vi.fn(async () => ({
        outcome: "installed",
        manifest: validManifest,
        contentHash: "sha256:abc123",
      })),
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

  function uploadZip(zipBuffer: Buffer, secret?: string, query = "") {
    const boundary = "----vitestboundary";
    return app.inject({
      method: "POST",
      url: `${PLUGINS_PATH}${query}`,
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
        // The signature binds the raw file bytes (not the multipart envelope) — see deferHmac.
        // The query string is deliberately not signature-bound (hmac-auth strips it).
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
      expect(res.json()).toMatchObject({
        pluginId: "case-summary",
        version: "0.1.0",
        contentHash: "sha256:abc123",
      });
      expect(pluginManager.installPackage).toHaveBeenCalledWith({
        pluginId: "case-summary",
        version: "0.1.0",
        manifestJson: expect.any(String),
        wasmBuffer: expect.any(Buffer),
        frontendDir: expect.any(String),
        logoSourcePath: undefined, // no logo declared
        overwrite: false,
      });
    });

    it("maps a conflict to 409 carrying both content hashes", async () => {
      pluginManager.installPackage.mockResolvedValueOnce({
        outcome: "conflict",
        currentContentHash: "sha256:abc123",
        uploadedContentHash: `sha256:${"b".repeat(64)}`,
      });
      const res = await uploadZip(makeZip(validManifest));
      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({
        code: "PLUGIN_VERSION_EXISTS",
        error: "Plugin version already exists: case-summary@0.1.0",
        // Both hashes, so callers can tell an identical re-upload apart from different content.
        currentContentHash: "sha256:abc123",
        uploadedContentHash: `sha256:${"b".repeat(64)}`,
      });
    });

    it("reports a conflict against an on-disk-but-unloaded version with a null current hash", async () => {
      pluginManager.installPackage.mockResolvedValueOnce({
        outcome: "conflict",
        currentContentHash: null,
        uploadedContentHash: `sha256:${"c".repeat(64)}`,
      });
      const res = await uploadZip(makeZip(validManifest));
      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ currentContentHash: null });
    });

    it("passes ?overwrite=true through as an explicit overwrite", async () => {
      const res = await uploadZip(makeZip(validManifest), undefined, "?overwrite=true");
      expect(res.statusCode).toBe(201);
      expect(pluginManager.installPackage).toHaveBeenCalledWith(
        expect.objectContaining({ overwrite: true })
      );
    });

    it("rejects an invalid manifest with 400 and validation details", async () => {
      const res = await uploadZip(makeZip({ pluginId: "x", version: "1.0.0" })); // no translations
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: "Invalid plugin manifest" });
      expect((res.json() as { details: string[] }).details.length).toBeGreaterThan(0);
      expect(pluginManager.installPackage).not.toHaveBeenCalled();
    });

    /**
     * The manifest is attacker-controlled, and `pluginId`/`version` become directory names while
     * `logo` names a file that is copied into the package. A traversal in any of them must be
     * refused before anything is written.
     */
    describe("package identity containment", () => {
      it.each([
        ["a traversing pluginId", { ...validManifest, pluginId: "../../app/dist" }],
        ["an uppercase pluginId", { ...validManifest, pluginId: "Case-Summary" }],
        ["a traversing version", { ...validManifest, version: "../../../etc" }],
      ])("refuses %s with 400 and never installs", async (_label, manifest) => {
        const res = await uploadZip(makeZip(manifest));
        expect(res.statusCode).toBe(400);
        expect(res.json()).toMatchObject({ error: "Invalid plugin manifest" });
        expect(pluginManager.installPackage).not.toHaveBeenCalled();
        // Nothing may have been written outside the temp extraction dir.
        expect(existsSync(join(TMP_BASE, "..", "dist", "manifest.json"))).toBe(false);
      });

      it("refuses a traversing logo declared in the manifest with 400", async () => {
        // Rejected by the shared validator before the route's own containment check even runs —
        // both gates exist so neither is the single point of failure.
        const res = await uploadZip(
          makeZip({ ...validManifest, logo: "../../../etc/passwd" })
        );
        expect(res.statusCode).toBe(400);
        expect(pluginManager.installPackage).not.toHaveBeenCalled();
      });

      it("passes a declared logo through as an absolute path inside the extraction directory", async () => {
        const zip = new AdmZip();
        zip.addFile("manifest.json", Buffer.from(JSON.stringify({ ...validManifest, logo: "logo.svg" })));
        zip.addFile("plugin.wasm", Buffer.from([0x00, 0x61, 0x73, 0x6d]));
        zip.addFile("logo.svg", Buffer.from("<svg/>"));

        const res = await uploadZip(zip.toBuffer());

        expect(res.statusCode).toBe(201);
        const call = pluginManager.installPackage.mock.calls[0][0] as { logoSourcePath: string };
        expect(call.logoSourcePath).toMatch(/[/\\]extracted[/\\]logo\.svg$/);
      });
    });

    it("rejects an upload whose file bytes are not correctly signed (401)", async () => {
      const res = await uploadZip(makeZip(validManifest), "attacker-secret");
      expect(res.statusCode).toBe(401);
      expect(pluginManager.installPackage).not.toHaveBeenCalled();
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
      expect(pluginManager.installPackage).not.toHaveBeenCalled();
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
