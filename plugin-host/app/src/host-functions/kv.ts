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
import type { KvRepository } from "../db/kv-repository.js";
import { guardHostCall } from "./guard.js";

interface KvRequest {
  op: string;
  key?: string;
  value?: unknown;
  prefix?: string;
}

export function createKvHostFunction(
  logger: HostLogger,
  kvRepository: KvRepository
): (callContext: CallContext, addr: bigint) => Promise<bigint> {
  const log = logger.child({ component: "kv" });

  return async (callContext: CallContext, addr: bigint): Promise<bigint> => {
    const guard = guardHostCall<KvRequest>(callContext, addr, "kv");
    if (!guard.ok) {
      return callContext.store(JSON.stringify({ status: guard.status, error: guard.message }));
    }
    const { ctx, req } = guard;

    try {
      switch (req.op) {
        case "get": {
          if (!req.key) {
            return callContext.store(JSON.stringify({ status: 400, error: "Missing 'key' for kv get" }));
          }
          const result = await kvRepository.get(ctx.configurationId, req.key);
          return callContext.store(
            JSON.stringify(result.found ? { status: 200, value: result.value } : { status: 404 })
          );
        }
        case "set": {
          if (!req.key) {
            return callContext.store(JSON.stringify({ status: 400, error: "Missing 'key' for kv set" }));
          }
          if (req.key.length > 256) {
            return callContext.store(JSON.stringify({ status: 400, error: "Key exceeds 256 characters" }));
          }
          await kvRepository.set(ctx.configurationId, req.key, req.value);
          log.debug({ configurationId: ctx.configurationId, key: req.key }, "kv set");
          return callContext.store(JSON.stringify({ status: 200 }));
        }
        case "delete": {
          if (!req.key) {
            return callContext.store(JSON.stringify({ status: 400, error: "Missing 'key' for kv delete" }));
          }
          const deleted = await kvRepository.delete(ctx.configurationId, req.key);
          return callContext.store(JSON.stringify({ status: deleted ? 200 : 404 }));
        }
        case "list": {
          const keys = await kvRepository.list(ctx.configurationId, req.prefix);
          return callContext.store(JSON.stringify({ status: 200, keys }));
        }
        default:
          return callContext.store(
            JSON.stringify({ status: 400, error: `Unknown kv op: ${req.op}` })
          );
      }
    } catch (err) {
      log.warn({ error: (err as Error).message, op: req.op }, "kv error");
      return callContext.store(
        JSON.stringify({ status: 500, error: `kv operation failed: ${(err as Error).message}` })
      );
    }
  };
}
