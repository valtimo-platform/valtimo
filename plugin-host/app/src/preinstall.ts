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

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { AppConfig } from "./config.js";
import type { HostLogger } from "./models/index.js";
import type { PluginManager } from "./plugin-manager.js";
import { installPluginZip, pluginInstallTmpBase } from "./plugin-package-install.js";

/**
 * Installs every `*.zip` in `PLUGIN_PREINSTALL_DIR` at boot — how an operator ships the plugins a
 * host should serve without an admin uploading them.
 *
 * A version already present with the same content hash is a no-op; one present with *different*
 * content is left alone and logged at warn, the same rule the upload route enforces.
 * `PLUGIN_PREINSTALL_OVERWRITE=true` opts out of that for throwaway environments.
 *
 * Nothing here is fatal, so a bad zip can never stop the host from starting.
 */
export async function preinstallPlugins(
  pluginManager: PluginManager,
  config: AppConfig,
  logger: HostLogger
): Promise<void> {
  const dir = config.PLUGIN_PREINSTALL_DIR;
  const log = logger.child({ component: "PluginPreinstall" });

  let fileNames: string[];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    // Sorted so the log reads the same on every boot.
    fileNames = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".zip"))
      .map((entry) => entry.name)
      .sort();
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      // The normal case for an image nobody mounted anything over.
      log.debug({ dir }, "No plugin pre-install directory — nothing to install");
    } else {
      log.warn(
        { dir, error: (err as Error).message },
        "Could not read the plugin pre-install directory — skipping pre-install"
      );
    }
    return;
  }

  if (fileNames.length === 0) {
    log.debug({ dir }, "Plugin pre-install directory holds no .zip files");
    return;
  }

  const tmpBase = pluginInstallTmpBase();
  let installed = 0;
  let unchanged = 0;
  let skipped = 0;

  for (const fileName of fileNames) {
    const path = join(dir, fileName);
    try {
      const zipBuffer = await readFile(path);
      const result = await installPluginZip(pluginManager, zipBuffer, {
        overwrite: false,
        tmpBase,
      });

      if (result.outcome === "invalid-manifest") {
        log.warn(
          { file: fileName, details: result.details },
          "Skipping pre-install package: invalid plugin manifest"
        );
        skipped++;
        continue;
      }

      if (result.outcome === "installed") {
        log.info(
          {
            file: fileName,
            pluginId: result.pluginId,
            version: result.version,
            contentHash: result.contentHash,
          },
          "Pre-installed plugin package"
        );
        installed++;
        continue;
      }

      // Conflict: this version is already served by the host.
      const { pluginId, version, currentContentHash, uploadedContentHash } = result;
      if (currentContentHash === uploadedContentHash) {
        log.debug(
          { file: fileName, pluginId, version, contentHash: currentContentHash },
          "Pre-install package already installed with identical content"
        );
        unchanged++;
        continue;
      }

      if (!config.PLUGIN_PREINSTALL_OVERWRITE) {
        log.warn(
          { file: fileName, pluginId, version, currentContentHash, uploadedContentHash },
          "Pre-install package differs from the installed version — keeping the installed one. " +
            "GZAC pins the content hash an admin accepted, so replacing it is an explicit " +
            "decision: upload the new package through GZAC, or set PLUGIN_PREINSTALL_OVERWRITE=true"
        );
        skipped++;
        continue;
      }

      const replaced = await installPluginZip(pluginManager, zipBuffer, {
        overwrite: true,
        tmpBase,
      });
      if (replaced.outcome === "installed") {
        log.warn(
          {
            file: fileName,
            pluginId,
            version,
            previousContentHash: currentContentHash,
            contentHash: replaced.contentHash,
          },
          "Replaced an installed plugin version from the pre-install directory " +
            "(PLUGIN_PREINSTALL_OVERWRITE=true)"
        );
        installed++;
      } else {
        log.warn(
          { file: fileName, pluginId, version, outcome: replaced.outcome },
          "Pre-install overwrite did not install the package"
        );
        skipped++;
      }
    } catch (err) {
      // Never stops the host starting, nor the remaining packages installing.
      log.warn(
        { file: fileName, error: (err as Error).message },
        "Skipping pre-install package: it could not be installed"
      );
      skipped++;
    }
  }

  log.info({ dir, installed, unchanged, skipped }, "Plugin pre-install complete");
}
