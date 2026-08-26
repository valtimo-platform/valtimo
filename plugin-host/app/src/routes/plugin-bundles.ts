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
 *
 * `no-cache` rather than a TTL: uploading with `overwrite=true` replaces a package in place, so the
 * bytes behind `/plugins/:pluginId/:version/bundles/*` can change while the URL does not. Under a
 * `max-age` the browser would keep serving the superseded bundle for the rest of the window with no
 * signal that it is stale — and the URL cannot be cache-busted from the outside, because a bundle's
 * HTML references its script with a bare relative path (`<script src="config.bundle.js">`), which
 * would leave the new shell running the old script. `no-cache` still permits storing; it just makes
 * reuse conditional on the {@link contentEtag} validator, so an unchanged bundle costs a 304 instead
 * of a re-transfer.
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
    .header("Cache-Control", "public, no-cache")
    .header("Access-Control-Allow-Origin", "*")
    .header("Content-Security-Policy", bundleCsp(ancestors))
    .header("X-Content-Type-Options", "nosniff")
    .header("Referrer-Policy", "no-referrer");
}

/**
 * Validator built from the package content hash the manager computed at install time. Free per
 * request — no file read, no hashing — and it changes whenever a version is replaced, which is the
 * only way the bytes behind one of these URLs can change.
 *
 * An ETag is scoped to its own URL, so the package hash alone is enough to tell two generations of
 * a given bundle apart. Sharing one validator across a package does mean editing one bundle
 * invalidates its siblings, which is deliberate: a published version is immutable in practice, so
 * the only time the bytes behind a fixed version change is while a plugin is being developed, and
 * re-downloading the sibling bundles is a development cost rather than a production one. Narrowing
 * it to a per-file validator would also mean maintaining a second hash alongside the package one,
 * which GZAC pins as its tamper-evidence signal (see `computeContentHash`) and needs at package
 * granularity.
 */
function packageEtag(contentHash: string): string {
  return `"${contentHash}"`;
}

/**
 * Whether the request's `If-None-Match` covers this entity. Handles the list form and the weak
 * prefix a proxy may add; `*` matches because the entity exists at all.
 */
function etagMatches(header: string | undefined, etag: string): boolean {
  if (!header) return false;
  return header
    .split(",")
    .map(candidate => candidate.trim())
    .some(candidate => candidate === "*" || candidate === etag || candidate === `W/${etag}`);
}

/**
 * Serve plugin-authored bytes with the hardening headers and a conditional-request short circuit.
 * The validator is set before the branch, so it is present on the 304 too and a cache that
 * revalidates repeatedly keeps a usable entry instead of dropping back to an unconditional fetch.
 *
 * `load` is a thunk rather than a buffer so that revalidation never opens the file: these bundles run
 * to megabytes, and reading one only to discard it would be the entire cost of answering a 304.
 */
async function sendPluginContent(
  request: import("fastify").FastifyRequest,
  reply: import("fastify").FastifyReply,
  contentType: string,
  ancestors: string[],
  etag: string,
  load: () => Promise<Buffer>
): Promise<void> {
  pluginContentHeaders(reply, contentType, ancestors).header("ETag", etag);

  if (etagMatches(request.headers["if-none-match"], etag)) {
    reply.code(304).send();
    return;
  }
  reply.send(await load());
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

      // Verify plugin exists. The hash is read here rather than next to its use so that both come
      // from the same tick: they are backed by the same in-memory record, so reading them without an
      // await in between means an unload cannot land in the gap and leave one of them missing.
      const manifest = pluginManager.getManifest(pluginId, version);
      const contentHash = pluginManager.getContentHash(pluginId, version);
      if (!manifest || !contentHash) {
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

      await sendPluginContent(
        request,
        reply,
        contentType,
        await frameAncestors(request),
        packageEtag(contentHash),
        () => readFile(fullPath)
      );
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

      // Read together, for the same reason as the bundle route above.
      const manifest = pluginManager.getManifest(pluginId, version);
      const contentHash = pluginManager.getContentHash(pluginId, version);
      if (!manifest || !contentHash) {
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
      // Same policy as the bundles: a logo is plugin-authored content too (an SVG can carry
      // script, which the CSP neutralises when the file is opened directly), and it is replaced by
      // an overwrite under the same URL just like a bundle is.
      await sendPluginContent(
        request,
        reply,
        contentType,
        await frameAncestors(request),
        packageEtag(contentHash),
        () => readFile(logoPath)
      );
    }
  );
}
