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

/**
 * Thread-local (call-scoped) configuration context.
 * Set by the runtime before each handler invocation.
 */
let currentConfig: Record<string, unknown> = {};

export function setCurrentConfig(cfg: Record<string, unknown>): void {
  currentConfig = cfg;
}

/**
 * Configuration accessor. Reads from the injected configuration context
 * of the current call — zero overhead, no host function call needed.
 */
export const config = {
  getAll(): Record<string, unknown> {
    return { ...currentConfig };
  },

  get(key: string): unknown {
    return currentConfig[key];
  },
};
