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
import { join, resolve, extname } from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const MIME_TYPES: Record<string, string> = {
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

/**
 * Public routes serving frontend bundles from plugin packages.
 *
 * GET /plugins/:pluginId/:version/bundles/* — serves static files from the
 * plugin's frontend/ directory. No authentication — these are public assets
 * loaded in iframes.
 */
export async function pluginBundleRoutes(
  fastify: FastifyInstance,
  opts: { pluginManager: PluginManager }
): Promise<void> {
  const { pluginManager } = opts;

  fastify.get<{ Params: { pluginId: string; version: string; "*": string } }>(
    "/plugins/:pluginId/:version/bundles/*",
    async (request, reply) => {
      const { pluginId, version } = request.params;
      const filePath = request.params["*"];

      if (!filePath) {
        reply.code(400).send({ error: "No file path specified" });
        return;
      }

      // Verify plugin exists
      const manifest = pluginManager.getManifest(pluginId, version);
      if (!manifest) {
        reply.code(404).send({ error: `Plugin not found: ${pluginId}@${version}` });
        return;
      }

      // Resolve full path and prevent directory traversal
      const pluginDir = pluginManager.getPluginDir(pluginId, version);
      const frontendDir = join(pluginDir, "frontend");
      const fullPath = resolve(frontendDir, filePath);

      if (!fullPath.startsWith(resolve(frontendDir))) {
        reply.code(403).send({ error: "Path traversal not allowed" });
        return;
      }

      if (!existsSync(fullPath)) {
        reply.code(404).send({ error: `File not found: ${filePath}` });
        return;
      }

      const ext = extname(fullPath);
      const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
      const content = await readFile(fullPath);

      reply
        .header("Content-Type", contentType)
        .header("Cache-Control", "public, max-age=3600")
        .header("Access-Control-Allow-Origin", "*")
        .send(content);
    }
  );
}
