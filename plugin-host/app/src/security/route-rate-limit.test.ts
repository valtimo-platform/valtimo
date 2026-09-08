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

import {beforeEach, describe, expect, it} from "vitest";
import type {FastifyInstance} from "fastify";
import {buildTestApp, signHeaders, testConfig} from "../test-support/harness";
import {resetReplayCacheForTests} from "./hmac-auth";
import {hostManagementRoutes} from "../routes/host-management";
import {pluginBundleRoutes} from "../routes/plugin-bundles";

const PLUGINS_PATH = "/api/host/plugins";

/**
 * The per-group request budgets: unauthenticated hammering of the HMAC admin routes is cut off
 * before the signature check, a signed client inside the budget keeps working, the public bundle
 * routes carry their own budget, and 0 disables a budget entirely.
 */
describe("route rate limiting", () => {
  beforeEach(() => resetReplayCacheForTests());

  async function managementApp(maxPerMinute: number): Promise<FastifyInstance> {
    return buildTestApp((a) =>
      hostManagementRoutes(a, {
        pluginManager: { listPlugins: () => [] } as never,
        configRegistry: {} as never,
        config: testConfig({ ADMIN_RATE_LIMIT_PER_MINUTE: maxPerMinute }),
      })
    );
  }

  async function bundlesApp(maxPerMinute: number): Promise<FastifyInstance> {
    return buildTestApp((a) =>
      pluginBundleRoutes(a, {
        pluginManager: {
          getManifest: () => undefined,
          getContentHash: () => undefined,
        } as never,
        frameAncestorRegistry: { allowedOrigins: async () => [] } as never,
        rateLimitPerMinute: maxPerMinute,
      })
    );
  }

  it("cuts off unauthenticated requests before the HMAC check once the budget is spent", async () => {
    const app = await managementApp(2);

    // No signature at all: the limiter still counts these — a brute-forcer never gets an
    // unmetered guess.
    expect((await app.inject({ method: "GET", url: PLUGINS_PATH })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: PLUGINS_PATH })).statusCode).toBe(401);
    const limited = await app.inject({ method: "GET", url: PLUGINS_PATH });
    expect(limited.statusCode).toBe(429);
  });

  it("serves a signed client normally within the budget", async () => {
    const app = await managementApp(10);

    const response = await app.inject({
      method: "GET",
      url: PLUGINS_PATH,
      headers: signHeaders("GET", PLUGINS_PATH),
    });

    expect(response.statusCode).toBe(200);
  });

  it("limits the public bundle routes on their own budget", async () => {
    const app = await bundlesApp(2);
    const url = "/plugins/some-plugin/1.0.0/logo";

    expect((await app.inject({ method: "GET", url })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url })).statusCode).toBe(429);
  });

  it("applies no limit when the budget is 0", async () => {
    const app = await managementApp(0);

    for (let i = 0; i < 5; i++) {
      expect((await app.inject({ method: "GET", url: PLUGINS_PATH })).statusCode).toBe(401);
    }
  });
});
