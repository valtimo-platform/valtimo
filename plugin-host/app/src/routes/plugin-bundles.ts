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
 * CSP for everything served out of a plugin package. The iframe sandbox already stops privilege
 * escalation (opaque origin — no GZAC session or token); this policy closes the *exfiltration*
 * channels a hostile bundle would otherwise have: `connect-src 'self'` kills fetch/XHR/beacon to
 * third parties, `script-src 'self'` kills remote script loading, `img-src`/`font-src` kill
 * pixel-beacon exfil, and `form-action 'self'` kills native form posts to external endpoints. An
 * honest plugin loses nothing — all of its GZAC traffic flows through the parent-proxy postMessage
 * transport, and its own assets all live under the same bundle path.
 *
 * The `sandbox` directive mirrors the embedding iframe's `sandbox="allow-scripts allow-forms"`
 * attribute so a bundle opened directly in a top-level tab is *also* confined to an opaque origin
 * instead of running same-origin with the host.
 */
const BUNDLE_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self'",
  "form-action 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "sandbox allow-scripts allow-forms",
].join("; ");

/** Shared hardening headers for plugin-authored content (bundles and the logo). */
function pluginContentHeaders(reply: import("fastify").FastifyReply, contentType: string) {
  return reply
    .header("Content-Type", contentType)
    .header("Cache-Control", "public, max-age=3600")
    .header("Access-Control-Allow-Origin", "*")
    .header("Content-Security-Policy", BUNDLE_CSP)
    .header("X-Content-Type-Options", "nosniff")
    .header("Referrer-Policy", "no-referrer");
}

/**
 * Public routes serving frontend bundles from plugin packages.
 *
 * GET /plugins/:pluginId/:version/bundles/* — serves static files from the
 * plugin's frontend/ directory. No authentication — these are public assets
 * loaded in iframes. Every response carries the strict {@link BUNDLE_CSP}.
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

      pluginContentHeaders(reply, contentType).send(content);
    }
  );

  /**
   * GET /plugins/:pluginId/:version/logo — serve the plugin logo
   *
   * The manifest's `logo` field (set by the pack tool when it detects a logo file at the plugin
   * root) names the file. 404 if no logo was shipped with the package.
   */
  fastify.get<{ Params: { pluginId: string; version: string } }>(
    "/plugins/:pluginId/:version/logo",
    async (request, reply) => {
      const { pluginId, version } = request.params;

      const manifest = pluginManager.getManifest(pluginId, version);
      if (!manifest) {
        reply.code(404).send({ error: `Plugin not found: ${pluginId}@${version}` });
        return;
      }

      if (!manifest.logo) {
        reply.code(404).send({ error: "No logo declared in manifest" });
        return;
      }

      const pluginDir = pluginManager.getPluginDir(pluginId, version);
      const logoPath = resolve(pluginDir, manifest.logo);
      if (!logoPath.startsWith(resolve(pluginDir)) || !existsSync(logoPath)) {
        reply.code(404).send({ error: "Logo file missing on disk" });
        return;
      }

      const ext = extname(logoPath);
      const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
      const content = await readFile(logoPath);
      // Same policy as the bundles: a logo is plugin-authored content too (an SVG can carry
      // script, which the CSP neutralises when the file is opened directly).
      pluginContentHeaders(reply, contentType).send(content);
    }
  );
}
