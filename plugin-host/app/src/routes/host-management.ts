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

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { PluginManager } from "../plugin-manager.js";
import { AppConfig } from "../config.js";
import { Readable } from "node:stream";
import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

/**
 * Admin-authenticated plugin management routes.
 *
 * All routes under /api/host/plugins require the ADMIN_TOKEN.
 */
export async function hostManagementRoutes(
  fastify: FastifyInstance,
  opts: { pluginManager: PluginManager; config: AppConfig }
): Promise<void> {
  const { pluginManager, config } = opts;

  // Admin auth hook for all routes in this plugin
  fastify.addHook(
    "onRequest",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authHeader = request.headers["authorization"];
      if (!authHeader) {
        reply.code(401).send({ error: "Missing Authorization header" });
        return;
      }

      const token = authHeader.replace(/^Bearer\s+/i, "");
      if (token !== config.ADMIN_TOKEN) {
        reply.code(403).send({ error: "Invalid admin token" });
        return;
      }
    }
  );

  /**
   * GET /api/host/plugins — list all loaded plugins (all versions)
   */
  fastify.get("/api/host/plugins", async () => {
    return pluginManager.listPlugins();
  });

  /**
   * GET /api/host/plugins/:pluginId — list all versions of a plugin
   */
  fastify.get<{ Params: { pluginId: string } }>(
    "/api/host/plugins/:pluginId",
    async (request) => {
      return pluginManager.listVersions(request.params.pluginId);
    }
  );

  /**
   * POST /api/host/plugins — upload plugin package (.zip)
   *
   * The .zip must contain manifest.json and plugin.wasm at the root level.
   * pluginId and version are extracted from the manifest.
   */
  fastify.post("/api/host/plugins", async (request, reply) => {
    const data = await request.file();
    if (!data) {
      reply.code(400).send({ error: "No file uploaded" });
      return;
    }

    // Write uploaded file to temp directory inside plugin-host/app/.tmp/
    const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
    const tmpBase = join(appRoot, ".tmp");
    await mkdir(tmpBase, { recursive: true });
    const tempDir = await mkdtemp(join(tmpBase, "plugin-upload-"));
    const zipPath = join(tempDir, "plugin.zip");

    try {
      // Collect the stream into a buffer
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const zipBuffer = Buffer.concat(chunks);
      const { writeFile: wf } = await import("node:fs/promises");
      await wf(zipPath, zipBuffer);

      // Extract zip
      const extractDir = join(tempDir, "extracted");
      execSync(`mkdir -p "${extractDir}" && unzip -o "${zipPath}" -d "${extractDir}"`, {
        stdio: "pipe",
      });

      // Read manifest
      const manifestPath = join(extractDir, "manifest.json");
      const manifestJson = await readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(manifestJson);

      if (!manifest.pluginId || !manifest.version) {
        reply
          .code(400)
          .send({ error: "manifest.json must contain pluginId and version" });
        return;
      }

      // Read wasm
      const wasmPath = join(extractDir, "plugin.wasm");
      const wasmBuffer = await readFile(wasmPath);

      // Check for frontend directory
      const frontendDir = join(extractDir, "frontend");

      // Store and load (includes frontend assets if present)
      const result = await pluginManager.storeAndLoad(
        manifest.pluginId,
        manifest.version,
        manifestJson,
        wasmBuffer,
        frontendDir
      );

      reply.code(201).send({
        pluginId: manifest.pluginId,
        version: manifest.version,
        manifest: result,
      });
    } catch (err) {
      request.log.error(
        { error: (err as Error).message },
        "Plugin upload failed"
      );
      reply.code(500).send({
        error: "Plugin upload failed",
        message: (err as Error).message,
      });
    } finally {
      // Cleanup temp directory
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  /**
   * DELETE /api/host/plugins/:pluginId/:version — unload and remove
   */
  fastify.delete<{ Params: { pluginId: string; version: string } }>(
    "/api/host/plugins/:pluginId/:version",
    async (request, reply) => {
      const { pluginId, version } = request.params;

      const manifest = pluginManager.getManifest(pluginId, version);
      if (!manifest) {
        reply.code(404).send({ error: `Plugin not found: ${pluginId}@${version}` });
        return;
      }

      await pluginManager.removePlugin(pluginId, version);
      reply.code(204).send();
    }
  );
}
