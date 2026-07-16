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

import type { FastifyPluginCallback } from "fastify";
import type { LogRepository } from "../db/log-repository.js";
import type { AppConfig } from "../models/index.js";
import { createHmacAuthHook } from "../security/hmac-auth.js";

interface PluginLogRoutesOptions {
  logRepository: LogRepository;
  config: AppConfig;
}

export const pluginLogRoutes: FastifyPluginCallback<PluginLogRoutesOptions> = (
  fastify,
  { logRepository, config },
  done
) => {
  const hmacAuth = createHmacAuthHook(config.ADMIN_TOKEN);

  fastify.get<{
    Params: { configId: string };
    Querystring: { page?: string; size?: string; level?: string; source?: string };
  }>(
    "/api/host/configurations/:configId/logs",
    { preHandler: hmacAuth },
    async (request, reply) => {
      const { configId } = request.params;
      const page = parseInt(request.query.page ?? "0", 10);
      const size = parseInt(request.query.size ?? "25", 10);
      const level = request.query.level || undefined;
      const source = request.query.source || undefined;

      const result = await logRepository.query(configId, { page, size, level, source });
      return reply.code(200).send(result);
    }
  );

  done();
};
