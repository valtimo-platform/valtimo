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

import type { CallContext } from "@extism/extism";
import type { HostLogger } from "../models/index.js";
import type { LogRepository } from "../db/log-repository.js";
import { guardHostCall } from "./guard.js";

interface LogRequest {
  level: string;
  message: string;
  data?: Record<string, unknown>;
}

export function createLogHostFunction(
  logger: HostLogger,
  logRepository: LogRepository
): (callContext: CallContext, addr: bigint) => Promise<bigint> {
  const hostLog = logger.child({ component: "plugin_log" });

  return async (callContext: CallContext, addr: bigint): Promise<bigint> => {
    const guard = guardHostCall<LogRequest>(callContext, addr, "log");
    if (!guard.ok) {
      return callContext.store(JSON.stringify({ status: guard.status, error: guard.message }));
    }
    const { ctx, req } = guard;

    const level = ["info", "warn", "error", "debug"].includes(req.level) ? req.level : "info";
    const message = (req.message ?? "").slice(0, 4096);

    const logData = {
      configurationId: ctx.configurationId,
      pluginId: ctx.pluginId,
      pluginVersion: ctx.pluginVersion,
      ...(req.data ?? {}),
    };

    switch (level) {
      case "warn":
        hostLog.warn(logData, message);
        break;
      case "error":
        hostLog.error(logData, message);
        break;
      case "debug":
        hostLog.debug(logData, message);
        break;
      default:
        hostLog.info(logData, message);
    }

    logRepository
      .insert({
        configurationId: ctx.configurationId,
        pluginId: ctx.pluginId,
        pluginVersion: ctx.pluginVersion,
        level,
        message,
        data: req.data,
        source: "plugin",
      })
      .catch((err) => {
        hostLog.warn({ error: (err as Error).message }, "Failed to persist plugin log entry");
      });

    return callContext.store(JSON.stringify({ status: 200 }));
  };
}
