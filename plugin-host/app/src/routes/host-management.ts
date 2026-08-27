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

import { FastifyInstance } from "fastify";
import { PluginManager } from "../plugin-manager.js";
import { ConfigRegistry } from "../config-registry.js";
import { AppConfig } from "../config.js";
import { installPluginZip, pluginInstallTmpBase } from "../plugin-package-install.js";
import { createHmacAuthHook, verifyDeferredHmac } from "../security/hmac-auth.js";
import { InvalidPluginPackageError } from "../errors.js";

// Re-exported so the existing import sites keep working now that the plugin manager raises it too.
export { InvalidPluginPackageError };

/**
 * Admin-authenticated plugin management routes.
 *
 * All routes under /api/host/plugins are HMAC-signed (same scheme as the action route): the
 * signature is computed over `{method}\n{path}\n{timestamp}\n{bodyHash}` with the host's ADMIN_TOKEN
 * as the key, and the ±5-minute timestamp window blocks replay. GET/DELETE bind an empty body; the
 * multipart upload binds the uploaded file bytes (verified inside its handler — see below).
 */
export async function hostManagementRoutes(
  fastify: FastifyInstance,
  opts: { pluginManager: PluginManager; configRegistry: ConfigRegistry; config: AppConfig }
): Promise<void> {
  const { pluginManager, configRegistry, config } = opts;

  // Authenticate every management route by HMAC signature. The upload route opts out (deferHmac)
  // and verifies itself once the uploaded file has been read, since it binds the file bytes.
  fastify.addHook("preHandler", createHmacAuthHook(config.ADMIN_TOKEN));

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
   *
   * An upload whose pluginId@version already exists is refused with 409 unless the caller sends
   * `?overwrite=true` — GZAC only does so after an admin explicitly confirmed the overwrite and
   * re-reviewed the package's requested permissions, so a version is never replaced silently.
   *
   * HMAC body binding: the signature covers the uploaded file bytes (the .zip), not the multipart
   * envelope — the backend signs the raw file bytes it sends, which the host reproduces below from
   * the parsed file stream. `deferHmac` skips the shared raw-body hook so verification can run once
   * the file has been read.
   */
  fastify.post("/api/host/plugins", { config: { deferHmac: true } }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      reply.code(400).send({ error: "No file uploaded" });
      return;
    }

    try {
      // Collect the stream into a buffer
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const zipBuffer = Buffer.concat(chunks);

      // The multipart parser truncates a stream that exceeds its size limit rather than erroring —
      // reject explicitly so an oversized upload can't slip through as a corrupt zip.
      if (data.file.truncated) {
        reply.code(413).send({
          error: `Plugin package exceeds the maximum upload size of ${config.UPLOAD_MAX_BYTES} bytes`,
        });
        return;
      }

      // Authenticate: the HMAC signature binds these exact file bytes (see deferHmac note above).
      if (!verifyDeferredHmac(request, reply, config.ADMIN_TOKEN, zipBuffer)) {
        return;
      }

      // Same pipeline the boot-time pre-install runs, so both meet identical containment checks.
      const result = await installPluginZip(pluginManager, zipBuffer, {
        overwrite: (request.query as {overwrite?: string}).overwrite === "true",
        tmpBase: pluginInstallTmpBase(),
      });

      if (result.outcome === "invalid-manifest") {
        reply
          .code(400)
          .send({ error: "Invalid plugin manifest", details: result.details });
        return;
      }

      if (result.outcome === "conflict") {
        reply.code(409).send({
          // Machine-readable so GZAC's upload UI can branch without string-matching English text.
          code: "PLUGIN_VERSION_EXISTS",
          error: `Plugin version already exists: ${result.pluginId}@${result.version}`,
          message:
            "This version already exists on the host. Overwriting requires explicit admin confirmation.",
          currentContentHash: result.currentContentHash,
          uploadedContentHash: result.uploadedContentHash,
        });
        return;
      }

      reply.code(201).send({
        pluginId: result.pluginId,
        version: result.version,
        contentHash: result.contentHash,
        manifest: result.manifest,
      });
    } catch (err) {
      request.log.error(
        { error: (err as Error).message },
        "Plugin upload failed"
      );
      if (err instanceof InvalidPluginPackageError) {
        reply.code(400).send({
          error: "Invalid plugin package",
          message: err.message,
        });
        return;
      }
      reply.code(500).send({
        error: "Plugin upload failed",
        message: (err as Error).message,
      });
    }
  });

  /**
   * DELETE /api/host/plugins/:pluginId/:version — unload and remove
   *
   * Refuses deletion if active configurations reference this plugin version.
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

      // Check for active configurations referencing this plugin version
      const activeConfigs = await configRegistry.listByPlugin(pluginId, version);
      if (activeConfigs.length > 0) {
        reply.code(409).send({
          error: `Cannot delete plugin: ${activeConfigs.length} active configuration(s) reference ${pluginId}@${version}`,
          configurationIds: activeConfigs.map((c) => c.configurationId),
        });
        return;
      }

      await pluginManager.removePlugin(pluginId, version);
      reply.code(204).send();
    }
  );
}
