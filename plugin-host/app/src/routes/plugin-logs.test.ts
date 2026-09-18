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

import type {FastifyInstance} from "fastify";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {buildTestApp, signHeaders, testConfig} from "../test-support/harness";
import {pluginLogRoutes} from "./plugin-logs";

const LOGS_PATH = "/api/host/configurations/cfg-1/logs";

describe("plugin-logs route", () => {
  let app: FastifyInstance;
  let logRepository: { query: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    logRepository = {
      query: vi.fn(async (_configId: string, params: { page: number; size: number }) => ({
        content: [],
        page: params.page,
        size: params.size,
        totalElements: 0,
      })),
    };
    app = await buildTestApp(async (a) => {
      await a.register(pluginLogRoutes, {
        logRepository: logRepository as never,
        config: testConfig(),
      });
    });
  });

  afterEach(async () => {
    await app.close();
  });

  function get(query: string) {
    return app.inject({
      method: "GET",
      url: `${LOGS_PATH}${query}`,
      headers: signHeaders("GET", LOGS_PATH),
    });
  }

  it("rejects an unsigned request with 401", async () => {
    const res = await app.inject({ method: "GET", url: LOGS_PATH });
    expect(res.statusCode).toBe(401);
  });

  it("passes coerced paging through and echoes it in the response", async () => {
    const res = await get("?page=2&size=50");
    expect(res.statusCode).toBe(200);
    expect(logRepository.query).toHaveBeenCalledWith("cfg-1", expect.objectContaining({ page: 2, size: 50 }));
    expect(res.json()).toMatchObject({ page: 2, size: 50 });
  });

  it("falls back to defaults for non-numeric page/size instead of passing NaN to SQL", async () => {
    const res = await get("?page=abc&size=%20");
    expect(res.statusCode).toBe(200);
    expect(logRepository.query).toHaveBeenCalledWith("cfg-1", expect.objectContaining({ page: 0, size: 25 }));
    expect(res.json()).toMatchObject({ page: 0, size: 25 });
  });

  it("clamps negative and oversized values", async () => {
    await get("?page=-5&size=10000");
    expect(logRepository.query).toHaveBeenCalledWith("cfg-1", expect.objectContaining({ page: 0, size: 100 }));
  });
});
