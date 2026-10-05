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
import type { GzacApiCallContext } from "./gzac-api.js";

export type HostCallGuardResult<TReq> =
  | { ok: true; ctx: GzacApiCallContext; req: TReq }
  | { ok: false; status: 500 | 403 | 400; message: string };

/**
 * Shared entry guard for every Extism host function: resolves the per-call host context, enforces
 * the configuration's granted-capability gate, and parses the plugin's JSON request. Each host
 * function maps a failed guard onto its own reply envelope, so this stays shape-agnostic.
 */
export function guardHostCall<TReq>(
  callContext: CallContext,
  addr: bigint,
  capability: string
): HostCallGuardResult<TReq> {
  const ctx = callContext.hostContext<GzacApiCallContext | undefined>();
  if (!ctx) {
    return { ok: false, status: 500, message: "No active invocation context" };
  }

  if (!ctx.grantedCapabilities?.includes(capability)) {
    return {
      ok: false,
      status: 403,
      message: `Capability '${capability}' not granted for this configuration`,
    };
  }

  const inputJson = callContext.read(addr)?.string() ?? "{}";
  try {
    return { ok: true, ctx, req: JSON.parse(inputJson) as TReq };
  } catch (err) {
    return {
      ok: false,
      status: 400,
      message: `Invalid ${capability} request JSON: ${(err as Error).message}`,
    };
  }
}
