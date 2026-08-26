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
import {FrameAncestorRegistry} from "../frame-ancestor-registry";
import type {GzacInstanceRepository} from "../db/gzac-instance-repository";
import {resetReplayCacheForTests} from "../security/hmac-auth";
import {buildTestApp, signHeaders, testConfig} from "../test-support/harness";
import {hostConfigurationRoutes} from "./host-configurations";
import {hostGzacInstanceRoutes} from "./host-gzac-instances";
import {pluginActionRoutes} from "./plugin-actions";
import {pluginSubmitRoutes} from "./plugin-submit";

const PLUGIN = "case-summary";
const VERSION = "0.1.0";

/**
 * Every route that captures the raw body for HMAC verification reads `request.raw` through
 * `fastify-raw-body` *while* Fastify parses the same stream. Fastify's default `text/plain` parser is
 * a string parser, so it would set an encoding on that stream and `raw-body` would then throw from
 * `Buffer.concat` inside a stream `end` callback — outside Fastify's promise chain, i.e. an uncaught
 * exception that kills the whole sidecar. Unauthenticated, on any of these routes.
 *
 * These specs pin the fix (`registerBodyParsing` drops the `text/plain` parser) at the boundary that
 * matters: the refusal is a plain 415 and it happens *before* authentication, so no signature is
 * needed to reach it. Before the fix they don't merely fail — they take the vitest worker down with
 * them, which is exactly the reported denial of service.
 */
describe("content-type hardening on rawBody routes", () => {
  let app: FastifyInstance;

  /** Every route registered on one app, so a single table can walk all five. */
  const routes: Array<{name: string; method: "POST" | "PUT"; url: string}> = [
    {
      name: "POST /api/host/configurations/:configId",
      method: "POST",
      url: "/api/host/configurations/cfg-1",
    },
    {
      name: "PUT /api/host/configurations/:configId",
      method: "PUT",
      url: "/api/host/configurations/cfg-1",
    },
    {name: "PUT /api/host/gzac-instances", method: "PUT", url: "/api/host/gzac-instances"},
    {
      name: "POST /plugins/:pluginId/:version/actions/:actionKey",
      method: "POST",
      url: `/plugins/${PLUGIN}/${VERSION}/actions/my-action`,
    },
    {
      name: "POST /plugins/:pluginId/:version/submit/:submitKey",
      method: "POST",
      url: `/plugins/${PLUGIN}/${VERSION}/submit/review`,
    },
  ];

  beforeEach(async () => {
    resetReplayCacheForTests();
    const configRegistry = {
      set: vi.fn(async () => {}),
      get: vi.fn(async () => undefined),
      delete: vi.fn(async () => true),
      list: vi.fn(async () => []),
    };
    const pluginManager = {
      getManifest: vi.fn(() => ({pluginId: PLUGIN, version: VERSION, actions: [{key: "my-action"}]})),
      getContentHash: vi.fn(() => "sha256:abc123"),
      callAction: vi.fn(async () => ({status: "completed", variables: {}})),
      callSubmit: vi.fn(async () => ({status: "completed", variables: {}})),
    };
    const eventConsumerManager = {sync: vi.fn(async () => {})};
    const gzacInstanceRepository = {
      upsert: vi.fn(async () => {}),
      listFresh: vi.fn(async () => []),
    };
    const config = testConfig();

    // Registered (not called inline) exactly like production: two of these route plugins install an
    // instance-wide HMAC preHandler, so they need production's encapsulation or every route would
    // run every hook and a valid signature would trip the shared replay cache on the second one.
    app = await buildTestApp(async (a) => {
      await a.register(hostConfigurationRoutes, {
        configRegistry: configRegistry as never,
        pluginManager: pluginManager as never,
        config,
        eventConsumerManager: eventConsumerManager as never,
      });
      await a.register(hostGzacInstanceRoutes, {
        frameAncestorRegistry: new FrameAncestorRegistry(
          gzacInstanceRepository as unknown as GzacInstanceRepository
        ),
        config,
      });
      await a.register(pluginActionRoutes, {
        pluginManager: pluginManager as never,
        configRegistry: configRegistry as never,
        config,
      });
      await a.register(pluginSubmitRoutes, {
        pluginManager: pluginManager as never,
        configRegistry: configRegistry as never,
        config,
      });
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe.each(routes)("$name", ({method, url}) => {
    it("refuses text/plain with 415 without needing a signature, and keeps serving", async () => {
      const res = await app.inject({
        method,
        url,
        headers: {"content-type": "text/plain"},
        payload: "anything",
      });

      expect(res.statusCode).toBe(415);
      // The host is still up: a second request gets served rather than hitting a dead process.
      const after = await app.inject({method, url, headers: {"content-type": "text/plain"}, payload: "x"});
      expect(after.statusCode).toBe(415);
    });

    it("refuses an unregistered content type with 415 as well", async () => {
      const res = await app.inject({
        method,
        url,
        headers: {"content-type": "application/xml"},
        payload: "<a/>",
      });

      expect(res.statusCode).toBe(415);
    });

    it("still lets application/json through to the HMAC hook, which rejects it unsigned with 401", async () => {
      const res = await app.inject({
        method,
        url,
        headers: {"content-type": "application/json"},
        payload: JSON.stringify({}),
      });

      expect(res.statusCode).toBe(401);
    });

    it("still accepts a correctly signed application/json body", async () => {
      const payload = JSON.stringify({});
      const res = await app.inject({
        method,
        url,
        headers: {"content-type": "application/json", ...signHeaders(method, url, payload)},
        payload,
      });

      // Past authentication: the body is rejected on its own merits (or handled), never with 401/415.
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(415);
    });
  });
});
