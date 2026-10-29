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

import {afterEach, describe, expect, it} from "vitest";
import type {FastifyInstance} from "fastify";
import {buildTestApp} from "../test-support/harness";
import {healthRoutes} from "./health";

describe("health route", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it("responds 200 with status UP", async () => {
    app = await buildTestApp((a) => healthRoutes(a));
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "UP" });
  });
});
