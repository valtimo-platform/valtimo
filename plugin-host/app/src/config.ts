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

import { ZodError, type TypeOf, type ZodTypeAny } from "zod";
import {
  PRODUCTION_DB_PORT,
  applyDatabasePolicy,
  envSchema,
  migrateEnvSchema,
} from "./models/index.js";
import type { AppConfig, MigrateConfig } from "./models/index.js";
import { ConfigurationError } from "./errors.js";

export type { AppConfig, MigrateConfig };

/**
 * Parses the environment, reporting every problem at once as one readable message.
 *
 * All of them together, not the first: an operator setting the host up for the first time should
 * get one list to work through rather than a restart per mistake.
 */
function parseEnv<S extends ZodTypeAny>(schema: S, raw: NodeJS.ProcessEnv): TypeOf<S> {
  const { env, missing } = applyDatabasePolicy(raw);
  const problems = missing.map((name) => `  ${name}: required in production (no default)`);

  try {
    const parsed = schema.parse(env);
    if (problems.length === 0) return parsed;
  } catch (err) {
    if (!(err instanceof ZodError)) throw err;
    problems.push(...err.issues.map((i) => `  ${i.path.join(".") || "(env)"}: ${i.message}`));
  }

  const dbHint = missing.length
    ? `\n\nThe plugin host needs its own PostgreSQL database. DB_PORT defaults to ${PRODUCTION_DB_PORT}.`
    : "";
  throw new ConfigurationError(
    `Invalid plugin host configuration:\n\n${problems.join("\n")}${dbHint}`
  );
}

export function loadConfig(): AppConfig {
  return parseEnv(envSchema, process.env);
}

// Same database, same check — else a misconfigured deploy migrates the dev one.
export function loadMigrateConfig(): MigrateConfig {
  return parseEnv(migrateEnvSchema, process.env);
}
