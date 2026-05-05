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

// In Extism JS PDK, host functions are declared and called via the Host object.
// For the POC, log is the only host function available.
// In production, gzacApi, http, kv would also be here.

// Declare the host function imports that the Wasm module can call.
// These are provided by the Plugin Host at runtime via Extism host functions.

/**
 * Logging — calls the host's log function.
 * In the POC, this writes to the host's pino logger.
 * In Wasm context, this calls the host function.
 * When running outside Wasm (e.g. during build/test), it falls back to console.
 */
export const log = {
  info(message: string): void {
    try {
      // @ts-ignore - Host global is injected by Extism PDK at runtime
      const Host = (globalThis as any).Host;
      if (Host?.getFunctions) {
        const fn = Host.getFunctions();
        if (fn?.log) {
          fn.log(JSON.stringify({ level: "info", message }));
          return;
        }
      }
    } catch {
      // Not in Wasm context
    }
    console.log(`[INFO] ${message}`);
  },

  warn(message: string): void {
    try {
      const Host = (globalThis as any).Host;
      if (Host?.getFunctions) {
        const fn = Host.getFunctions();
        if (fn?.log) {
          fn.log(JSON.stringify({ level: "warn", message }));
          return;
        }
      }
    } catch {
      // Not in Wasm context
    }
    console.warn(`[WARN] ${message}`);
  },

  error(message: string): void {
    try {
      const Host = (globalThis as any).Host;
      if (Host?.getFunctions) {
        const fn = Host.getFunctions();
        if (fn?.log) {
          fn.log(JSON.stringify({ level: "error", message }));
          return;
        }
      }
    } catch {
      // Not in Wasm context
    }
    console.error(`[ERROR] ${message}`);
  },
};
