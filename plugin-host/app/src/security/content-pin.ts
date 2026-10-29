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

import type { PluginConfiguration } from "../models/index.js";

interface ContentHashSource {
  getContentHash(pluginId: string, version: string): string | null;
}

/** Narrow enough to accept both a `HostLogger` and Fastify's per-request logger. */
interface RefusalLogger {
  warn(obj: Record<string, unknown>, msg?: string): void;
}

export const CONTENT_CHANGED_ERROR_CODE = "EXTERNAL_PLUGIN_CONTENT_CHANGED";

/** 409 body for a refused call. Never sent on the public /data route — see `checkContentPin`. */
export interface ContentPinRefusal {
  error: string;
  errorCode: typeof CONTENT_CHANGED_ERROR_CODE;
  expectedContentHash: string;
  actualContentHash: string | null;
}

/**
 * Refuses to execute a plugin whose package bytes no longer match the hash the owning GZAC pinned.
 * Returns `null` when the call may proceed; a configuration with no pushed pin proceeds too.
 *
 * `errorCode` is load-bearing: `ExternalPluginServiceTaskStartListener.actionFailed` reads it off
 * the body, and a bare 409 would surface in the process incident as `EXTERNAL_PLUGIN_409`.
 */
export function checkContentPin(
  config: PluginConfiguration,
  pluginManager: ContentHashSource,
  log: RefusalLogger
): ContentPinRefusal | null {
  const expectedContentHash = config.expectedContentHash;
  if (!expectedContentHash) return null;

  const actualContentHash = pluginManager.getContentHash(config.pluginId, config.pluginVersion);
  if (actualContentHash === expectedContentHash) return null;

  log.warn(
    {
      configurationId: config.configurationId,
      pluginId: config.pluginId,
      pluginVersion: config.pluginVersion,
      expectedContentHash,
      actualContentHash,
    },
    "Refusing plugin execution: package content hash mismatch"
  );

  return {
    error: `Package content hash mismatch for ${config.pluginId}@${config.pluginVersion}`,
    errorCode: CONTENT_CHANGED_ERROR_CODE,
    expectedContentHash,
    actualContentHash,
  };
}
