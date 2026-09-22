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

function callLogHostFunction(level: string, message: string, data?: Record<string, unknown>): void {
  try {
    const Host = (globalThis as Record<string, unknown>).Host as
      | { getFunctions(): Record<string, unknown> }
      | undefined;
    const Memory = (globalThis as Record<string, unknown>).Memory as
      | {
          fromString(s: string): { offset: bigint | number };
        }
      | undefined;

    if (Host?.getFunctions && Memory?.fromString) {
      const fn = Host.getFunctions().log as
        | ((input: bigint | number) => void)
        | undefined;
      if (typeof fn === "function") {
        const payload: Record<string, unknown> = { level, message };
        if (data !== undefined) {
          payload.data = data;
        }
        const mem = Memory.fromString(JSON.stringify(payload));
        fn(mem.offset);
        return;
      }
    }
  } catch {
    // Not in Wasm context
  }

  const prefix = `[${level.toUpperCase()}]`;
  const extra = data ? ` ${JSON.stringify(data)}` : "";
  switch (level) {
    case "warn":
      console.warn(`${prefix} ${message}${extra}`);
      break;
    case "error":
      console.error(`${prefix} ${message}${extra}`);
      break;
    case "debug":
      console.debug(`${prefix} ${message}${extra}`);
      break;
    default:
      console.log(`${prefix} ${message}${extra}`);
  }
}

export const log = {
  info(message: string, data?: Record<string, unknown>): void {
    callLogHostFunction("info", message, data);
  },
  warn(message: string, data?: Record<string, unknown>): void {
    callLogHostFunction("warn", message, data);
  },
  error(message: string, data?: Record<string, unknown>): void {
    callLogHostFunction("error", message, data);
  },
  debug(message: string, data?: Record<string, unknown>): void {
    callLogHostFunction("debug", message, data);
  },
};
