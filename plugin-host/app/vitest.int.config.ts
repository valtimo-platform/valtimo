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

import {defineConfig} from "vitest/config";

/**
 * L4 (integration) test config. Spins up real Postgres and RabbitMQ via Testcontainers, so it
 * requires a running Docker daemon. Kept separate from `npm test` — run with `npm run test:int`.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/integration/**/*.test.ts"],
    // Pulling images + booting containers is slow; run integration files one at a time so we don't
    // hold several containers open at once.
    fileParallelism: false,
    hookTimeout: 180_000,
    testTimeout: 60_000,
  },
});
