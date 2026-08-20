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
import type { FrameAncestorSource } from "../frame-ancestor-registry.js";
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
 *
 * `frame-ancestors` is appended per request from the registry (see {@link bundleCsp}) — it is the
 * one directive whose value depends on which GZAC frontends currently use this host.
 */
const BUNDLE_CSP_DIRECTIVES = [
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
];

/**
 * The full policy for a response, given the origins currently allowed to embed this host's plugin
 * screens. With none registered the policy is `frame-ancestors 'none'` — **fail closed**: a plugin
 * that nothing may frame is a visible, fixable misconfiguration, whereas a framable-by-anyone plugin
 * is the vulnerability this directive exists to close.
 */
function bundleCsp(ancestors: string[]): string {
  const frameAncestors = ancestors.length > 0 ? ancestors.join(" ") : "'none'";
  return [...BUNDLE_CSP_DIRECTIVES, `frame-ancestors ${frameAncestors}`].join("; ");
}

/**
 * Shared hardening headers for plugin-authored content (bundles and the logo).
 *
 * `X-Frame-Options: DENY` is added only in the empty-allowlist case: the header has no allowlist
 * form (its `ALLOW-FROM` was removed from every browser), so it can only express "deny everything".
 * Sending it alongside a populated `frame-ancestors` would break the legitimate embed in browsers
 * that honour the older header.
 */
function pluginContentHeaders(
  reply: import("fastify").FastifyReply,
  contentType: string,
  ancestors: string[]
) {
  if (ancestors.length === 0) {
    reply.header("X-Frame-Options", "DENY");
  }
  return reply
    .header("Content-Type", contentType)
    .header("Cache-Control", "public, max-age=3600")
    .header("Access-Control-Allow-Origin", "*")
    .header("Content-Security-Policy", bundleCsp(ancestors))
    .header("X-Content-Type-Options", "nosniff")
    .header("Referrer-Policy", "no-referrer");
}

/**
 * Public routes serving frontend bundles from plugin packages.
 *
 * GET /plugins/:pluginId/:version/bundles/* — serves static files from the
 * plugin's frontend/ directory. No authentication — these are public assets
 * loaded in iframes. Every response carries the strict CSP built by {@link bundleCsp},
 * including the `frame-ancestors` allowlist that decides who may embed the plugin.
 */
export async function pluginBundleRoutes(
  fastify: FastifyInstance,
  opts: { pluginManager: PluginManager; frameAncestorRegistry: FrameAncestorSource }
): Promise<void> {
  const { pluginManager, frameAncestorRegistry } = opts;
  // One warning per process, not per request: an empty allowlist means every plugin screen in every
  // GZAC is blank, so the operator needs the reason once — loudly — not on repeat.
  let warnedAboutEmptyAllowlist = false;

  async function frameAncestors(request: import("fastify").FastifyRequest): Promise<string[]> {
    const ancestors = await frameAncestorRegistry.allowedOrigins();
    if (ancestors.length === 0 && !warnedAboutEmptyAllowlist) {
      warnedAboutEmptyAllowlist = true;
      request.log.warn(
        "Serving plugin content with frame-ancestors 'none': no GZAC instance has registered a " +
          "frontend origin with this host, so no page may embed these plugins. Register the " +
          "browser origin on the host in GZAC's plugin management screen, or set " +
          "ALLOWED_FRAME_ANCESTORS on this host."
      );
    }
    return ancestors;
  }

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

      pluginContentHeaders(reply, contentType, await frameAncestors(request)).send(content);
    }
  );

  /**
   * GET /plugins/:pluginId/:version/frame-policy?origin=<origin> — is this origin allowed to embed
   * the plugin?
   *
   * A probe, deliberately not a listing: the caller must already know the origin it is asking
   * about, so the route never enumerates which GZAC frontends use this host. The frontend SDK uses
   * it as defence in depth for deployments where a proxy strips the CSP header; the
   * `frame-ancestors` directive above remains the authoritative gate, because an embedder cannot
   * strip that.
   *
   * Public and CORS-open like the manifest: the caller is a sandboxed iframe at an opaque origin,
   * whose requests carry `Origin: null` and so cannot be allowlisted.
   */
  fastify.get<{ Params: { pluginId: string; version: string }; Querystring: { origin?: string } }>(
    "/plugins/:pluginId/:version/frame-policy",
    async (request, reply) => {
      const { pluginId, version } = request.params;
      if (!pluginManager.getManifest(pluginId, version)) {
        reply.code(404).send({ error: `Plugin not found: ${pluginId}@${version}` });
        return;
      }

      const origin = request.query.origin;
      const allowed = typeof origin === "string" && origin.length > 0
        ? await frameAncestorRegistry.isAllowed(origin)
        : false;

      reply
        .header("Access-Control-Allow-Origin", "*")
        .header("Cache-Control", "no-store")
        .send({ allowed });
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
      pluginContentHeaders(reply, contentType, await frameAncestors(request)).send(content);
    }
  );
}
