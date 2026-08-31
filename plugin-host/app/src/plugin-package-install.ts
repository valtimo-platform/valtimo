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

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";
import { validatePluginManifest } from "@valtimo/plugin-sdk/manifest-validation";
import { InvalidPluginPackageError } from "./errors.js";
import type { PluginManager } from "./plugin-manager.js";
import type { PluginManifest } from "./models/index.js";

/**
 * Extracts a plugin package entry-by-entry, defending against zip-slip: every entry's resolved
 * destination must stay inside `extractDir` (a crafted `../`, absolute, or drive-letter entry name
 * rejects the whole package). Additionally only the files a plugin package may legitimately carry
 * are extracted — root-level files (manifest.json, plugin.wasm, the logo) and `frontend/**` — so a
 * hostile zip cannot plant anything else even inside the temp dir.
 */
export async function safeExtractPluginZip(zip: AdmZip, extractDir: string): Promise<void> {
  const root = resolve(extractDir);
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const name = entry.entryName;
    const destination = resolve(root, name);
    if (destination !== root && !destination.startsWith(root + sep)) {
      throw new InvalidPluginPackageError(
        `Zip entry escapes the extraction directory: ${name}`
      );
    }
    // Allowlist: root-level files or frontend assets only.
    const isRootFile = !name.includes("/") && !name.includes("\\");
    const isFrontendAsset = name.startsWith("frontend/");
    if (!isRootFile && !isFrontendAsset) {
      continue;
    }
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, entry.getData());
  }
}

/**
 * Outcome of {@link installPluginZip}. Containment failures the validator cannot phrase (zip-slip, a
 * logo outside the package root) are raised as {@link InvalidPluginPackageError} instead.
 */
export type PluginZipInstallResult =
  | {
      outcome: "installed";
      pluginId: string;
      version: string;
      contentHash: string;
      manifest: PluginManifest;
    }
  | {
      outcome: "conflict";
      pluginId: string;
      version: string;
      currentContentHash: string | null;
      uploadedContentHash: string;
    }
  | { outcome: "invalid-manifest"; details: string[] };

/** Base directory for temporary extraction directories: `<app>/.tmp`. */
export function pluginInstallTmpBase(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", ".tmp");
}

/**
 * Turns a plugin package (.zip) into an installed, loaded plugin version: extract with zip-slip
 * protection, validate the manifest, read the wasm, resolve frontend assets and logo, install.
 *
 * Callers own authentication and size limits. The bytes are trusted to be *from* an authorised
 * source, but nothing about their *content* is — every check below treats the manifest as
 * attacker-controlled.
 */
export async function installPluginZip(
  pluginManager: PluginManager,
  zipBuffer: Buffer,
  options: { overwrite: boolean; tmpBase: string }
): Promise<PluginZipInstallResult> {
  await mkdir(options.tmpBase, { recursive: true });
  const tempDir = await mkdtemp(join(options.tmpBase, "plugin-upload-"));

  try {
    // Extract zip — per entry, with zip-slip protection (see safeExtractPluginZip).
    const extractDir = join(tempDir, "extracted");
    const zip = new AdmZip(zipBuffer);
    await safeExtractPluginZip(zip, extractDir);

    // Read manifest
    const manifestPath = join(extractDir, "manifest.json");
    const manifestJson = await readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(manifestJson);

    const validationErrors = validatePluginManifest(manifest);
    if (validationErrors.length > 0) {
      return { outcome: "invalid-manifest", details: validationErrors };
    }

    // Read wasm
    const wasmPath = join(extractDir, "plugin.wasm");
    const wasmBuffer = await readFile(wasmPath);

    // Check for frontend directory
    const frontendDir = join(extractDir, "frontend");

    // The logo file name comes from the untrusted manifest. Require a plain file directly inside
    // the extraction directory: a value like `../../../etc/passwd` would otherwise be copied into
    // the package, and into the content hash GZAC pins.
    let logoPath: string | undefined;
    if (manifest.logo !== undefined) {
      const extractRoot = resolve(extractDir);
      const resolvedLogo = resolve(extractRoot, manifest.logo);
      if (dirname(resolvedLogo) !== extractRoot) {
        throw new InvalidPluginPackageError(
          `manifest.logo must be a file at the package root: ${manifest.logo}`
        );
      }
      logoPath = resolvedLogo;
    }

    // A version is never replaced silently: without `overwrite` the manager reports a conflict
    // carrying both hashes, so an identical re-install is distinguishable from real drift.
    const result = await pluginManager.installPackage({
      pluginId: manifest.pluginId,
      version: manifest.version,
      manifestJson,
      wasmBuffer,
      frontendDir,
      logoSourcePath: logoPath,
      overwrite: options.overwrite,
    });

    if (result.outcome === "conflict") {
      return {
        outcome: "conflict",
        pluginId: manifest.pluginId,
        version: manifest.version,
        currentContentHash: result.currentContentHash,
        uploadedContentHash: result.uploadedContentHash,
      };
    }

    return {
      outcome: "installed",
      pluginId: manifest.pluginId,
      version: manifest.version,
      contentHash: result.contentHash,
      manifest: result.manifest,
    };
  } finally {
    // Cleanup temp directory
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
