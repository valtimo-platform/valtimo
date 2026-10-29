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

import {beforeEach, describe, expect, it, vi} from "vitest";
import type {LogRepository} from "../db/log-repository.js";
import type {HostLogger} from "../models/index.js";
import type {GzacApiCallContext} from "./gzac-api.js";
import {createLogHostFunction} from "./log";

const baseCtx: GzacApiCallContext = {
  configurationId: "cfg-1",
  pluginId: "case-summary",
  pluginVersion: "0.1.0",
  serviceToken: "service-token-abc",
  gzacBaseUrl: "http://gzac:8080",
  grantedCapabilities: ["log"],
};

interface LoggerDouble {
  logger: HostLogger;
  child: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
  };
  childBindings: Record<string, unknown> | undefined;
}

function loggerDouble(): LoggerDouble {
  const child = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  const double: LoggerDouble = {
    childBindings: undefined,
    child,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: (bindings: Record<string, unknown>) => {
        double.childBindings = bindings;
        return {...child, child: () => ({} as HostLogger)} as unknown as HostLogger;
      },
    } as unknown as HostLogger,
  };
  return double;
}

let logger: LoggerDouble;
let insert: ReturnType<typeof vi.fn>;

async function invoke(
  request: unknown,
  {ctx = baseCtx, noContext = false}: {ctx?: GzacApiCallContext; noContext?: boolean} = {}
) {
  const stored: string[] = [];
  const inputJson = typeof request === "string" ? request : JSON.stringify(request);
  const callContext = {
    hostContext: () => (noContext ? undefined : ctx),
    read: (_addr: bigint) => ({string: () => inputJson}),
    store: (s: string) => {
      stored.push(s);
      return 0n;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  const fn = createLogHostFunction(logger.logger, {insert} as unknown as LogRepository);
  await fn(callContext, 0n);
  return JSON.parse(stored.at(-1)!);
}

describe("log host function", () => {
  beforeEach(() => {
    logger = loggerDouble();
    insert = vi.fn(async () => {});
  });

  describe("capability gate", () => {
    it("returns 403 without logging or persisting when the log capability is not granted", async () => {
      const reply = await invoke(
        {level: "info", message: "hello"},
        {ctx: {...baseCtx, grantedCapabilities: ["kv"]}}
      );
      expect(reply).toEqual({
        status: 403,
        error: "Capability 'log' not granted for this configuration",
      });
      expect(insert).not.toHaveBeenCalled();
      expect(logger.child.info).not.toHaveBeenCalled();
    });

    it("returns 500 when there is no invocation context", async () => {
      const reply = await invoke({level: "info", message: "hello"}, {noContext: true});
      expect(reply).toEqual({status: 500, error: "No active invocation context"});
      expect(insert).not.toHaveBeenCalled();
    });

    it("returns 400 for unparseable request JSON", async () => {
      const reply = await invoke("{nope");
      expect(reply.status).toBe(400);
      expect(reply.error).toContain("Invalid log request JSON");
      expect(insert).not.toHaveBeenCalled();
    });
  });

  describe("level routing", () => {
    it.each(["info", "warn", "error", "debug"] as const)(
      "routes level %s to the matching host logger method and stores it",
      async (level) => {
        const reply = await invoke({level, message: `a ${level} line`});

        expect(reply).toEqual({status: 200});
        expect(logger.child[level]).toHaveBeenCalledTimes(1);
        expect(logger.child[level].mock.calls[0][1]).toBe(`a ${level} line`);
        expect(insert.mock.calls[0][0].level).toBe(level);
      }
    );

    it.each(["trace", "fatal", "", undefined])(
      "coerces the unknown level %j to info in both the log line and the row",
      async (level) => {
        await invoke({level, message: "odd level"});
        expect(logger.child.info).toHaveBeenCalledTimes(1);
        expect(insert.mock.calls[0][0].level).toBe("info");
      }
    );

    it("tags the child logger with the plugin_log component", async () => {
      await invoke({level: "info", message: "x"});
      expect(logger.childBindings).toEqual({component: "plugin_log"});
    });
  });

  describe("message and structured data", () => {
    it("truncates a long message to 4096 characters", async () => {
      await invoke({level: "info", message: "x".repeat(5000)});
      expect(logger.child.info.mock.calls[0][1]).toHaveLength(4096);
      expect(insert.mock.calls[0][0].message).toHaveLength(4096);
    });

    it("turns an absent message into an empty string", async () => {
      await invoke({level: "info"});
      expect(logger.child.info.mock.calls[0][1]).toBe("");
      expect(insert.mock.calls[0][0].message).toBe("");
    });

    it("merges structured data into the log line alongside the plugin identity", async () => {
      await invoke({level: "info", message: "summary built", data: {documentId: "doc-1", n: 2}});
      expect(logger.child.info.mock.calls[0][0]).toEqual({
        configurationId: "cfg-1",
        pluginId: "case-summary",
        pluginVersion: "0.1.0",
        documentId: "doc-1",
        n: 2,
      });
    });

    it("stores the structured data as given, and undefined when absent", async () => {
      await invoke({level: "info", message: "m", data: {a: 1}});
      expect(insert.mock.calls[0][0].data).toEqual({a: 1});

      await invoke({level: "info", message: "m"});
      expect(insert.mock.calls[1][0].data).toBeUndefined();
    });

    it("cannot be tricked into writing another configuration's identity", async () => {
      await invoke({
        level: "info",
        message: "m",
        data: {},
        configurationId: "cfg-victim",
        pluginId: "other",
      });
      expect(insert.mock.calls[0][0]).toMatchObject({
        configurationId: "cfg-1",
        pluginId: "case-summary",
        pluginVersion: "0.1.0",
        source: "plugin",
      });
    });
  });

  describe("persistence is fire-and-forget", () => {
    it("persists with source 'plugin' for admin visibility", async () => {
      await invoke({level: "warn", message: "careful", data: {code: 7}});
      expect(insert).toHaveBeenCalledTimes(1);
      expect(insert.mock.calls[0][0]).toEqual({
        configurationId: "cfg-1",
        pluginId: "case-summary",
        pluginVersion: "0.1.0",
        level: "warn",
        message: "careful",
        data: {code: 7},
        source: "plugin",
      });
    });

    it("still returns 200 when the insert fails, and swallows the rejection", async () => {
      insert.mockRejectedValue(new Error("db down"));
      const reply = await invoke({level: "info", message: "m"});
      expect(reply).toEqual({status: 200});
      // Let the rejected promise settle — an unguarded .catch would surface as an unhandled rejection.
      await new Promise((resolve) => setImmediate(resolve));
    });
  });
});
