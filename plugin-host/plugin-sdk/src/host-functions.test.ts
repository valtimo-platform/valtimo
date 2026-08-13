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

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {log} from "./host-functions";
import {stubWasmGlobals} from "./test-support/wasm-globals";

/**
 * The `log` wrapper. It is fire-and-forget by design: a plugin's logging must never
 * throw, and outside Wasm (a plugin author's local build or unit test) it has to degrade to the
 * console instead of failing.
 */
describe("log", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("inside a compiled plugin", () => {
    it.each(["info", "warn", "error", "debug"] as const)(
      "sends level %s with the message",
      (level) => {
        const stub = stubWasmGlobals("log");

        log[level]("a message");

        expect(stub.requests[0]).toEqual({level, message: "a message"});
      }
    );

    it("includes structured data when supplied", () => {
      const stub = stubWasmGlobals("log");

      log.info("summary built", {documentId: "doc-1", currency: "EUR"});

      expect(stub.requests[0]).toEqual({
        level: "info",
        message: "summary built",
        data: {documentId: "doc-1", currency: "EUR"},
      });
    });

    it("omits the data field entirely when not supplied", () => {
      const stub = stubWasmGlobals("log");

      log.info("no context");

      expect(stub.requests[0]).not.toHaveProperty("data");
    });

    it("returns undefined — logging is fire-and-forget with no reply to read", () => {
      stubWasmGlobals("log");
      expect(log.info("m")).toBeUndefined();
    });
  });

  describe("outside a compiled plugin (build/test fallback)", () => {
    let consoleSpies: Record<string, ReturnType<typeof vi.spyOn>>;

    beforeEach(() => {
      consoleSpies = {
        log: vi.spyOn(console, "log").mockImplementation(() => {}),
        warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
        error: vi.spyOn(console, "error").mockImplementation(() => {}),
        debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
      };
    });

    it.each([
      ["info", "log", "[INFO]"],
      ["warn", "warn", "[WARN]"],
      ["error", "error", "[ERROR]"],
      ["debug", "debug", "[DEBUG]"],
    ] as const)("routes %s to console.%s with a level prefix", (level, consoleMethod, prefix) => {
      stubWasmGlobals("log", {hostMissing: true});

      log[level]("a message");

      expect(consoleSpies[consoleMethod]).toHaveBeenCalledWith(`${prefix} a message`);
    });

    it("appends serialised data to the console line", () => {
      stubWasmGlobals("log", {hostMissing: true});

      log.info("summary built", {documentId: "doc-1"});

      expect(consoleSpies.log).toHaveBeenCalledWith(
        '[INFO] summary built {"documentId":"doc-1"}'
      );
    });

    it("falls back to the console when the host function is absent from the import table", () => {
      // The `log` capability was not granted/declared, so the import table has no `log` entry.
      stubWasmGlobals("log", {fnMissing: true});

      log.warn("degraded");

      expect(consoleSpies.warn).toHaveBeenCalledWith("[WARN] degraded");
    });

    it("never throws, even when Memory marshalling blows up", () => {
      vi.stubGlobal("Host", {
        getFunctions: () => ({
          log: () => {
            throw new Error("wasm boom");
          },
        }),
      });
      vi.stubGlobal("Memory", {
        fromString: () => {
          throw new Error("out of memory");
        },
      });

      expect(() => log.error("still fine")).not.toThrow();
      // The failure degrades to the console rather than propagating into plugin code.
      expect(consoleSpies.error).toHaveBeenCalledWith("[ERROR] still fine");
    });
  });
});
