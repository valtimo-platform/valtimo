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

import { afterEach, describe, expect, it } from "vitest";
import { loadConfig, loadMigrateConfig } from "./config";
import { ConfigurationError } from "./errors";
import { MIN_ADMIN_TOKEN_LENGTH } from "./models/app-config";

const VALID_TOKEN = "a".repeat(MIN_ADMIN_TOKEN_LENGTH);
const original = process.env;

afterEach(() => {
  process.env = original;
});

/** Replaces the environment wholesale — a container starts with what its operator set, nothing more. */
function startWith(env: NodeJS.ProcessEnv): void {
  process.env = env as NodeJS.ProcessEnv;
}

describe("loadConfig", () => {
  it("accepts a checkout with nothing but a token", () => {
    startWith({ ADMIN_TOKEN: VALID_TOKEN });
    const cfg = loadConfig();
    expect(cfg.DB_HOST).toBe("localhost");
    expect(cfg.DB_PORT).toBe(5434);
  });

  it("lists every problem at once for an unconfigured container", () => {
    // What a customer gets from `docker run` with no environment at all. One list, one restart.
    startWith({ NODE_ENV: "production" });

    const err = captureConfigError(() => loadConfig());
    expect(err.message).toContain("ADMIN_TOKEN");
    for (const name of ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"]) {
      expect(err.message).toContain(name);
    }
    expect(err.message).toContain("DB_PORT defaults to 5432");
    // The rationale for withdrawing the dev defaults is ours, not the reader's.
    expect(err.message).not.toMatch(/developer|development default/i);
  });

  it("does not mention the database when only the token is wrong", () => {
    startWith({
      NODE_ENV: "production",
      ADMIN_TOKEN: "short",
      DB_HOST: "db",
      DB_NAME: "pluginhost",
      DB_USER: "pluginhost",
      DB_PASSWORD: "s3cret",
    });

    const err = captureConfigError(() => loadConfig());
    expect(err.message).toMatch(/at least 16 characters/);
    expect(err.message).not.toContain("PostgreSQL");
  });

  it("uses 5432 for a configured production container", () => {
    startWith({
      NODE_ENV: "production",
      ADMIN_TOKEN: VALID_TOKEN,
      DB_HOST: "db",
      DB_NAME: "pluginhost",
      DB_USER: "pluginhost",
      DB_PASSWORD: "s3cret",
    });
    expect(loadConfig().DB_PORT).toBe(5432);
  });
});

describe("loadMigrateConfig", () => {
  it("refuses an unconfigured production migration job", () => {
    // Else the deploy job migrates whatever the defaults point at and fails only later, at app boot.
    startWith({ NODE_ENV: "production" });
    expect(() => loadMigrateConfig()).toThrow(ConfigurationError);
  });

  it("never demands ADMIN_TOKEN", () => {
    startWith({
      NODE_ENV: "production",
      DB_HOST: "db",
      DB_NAME: "pluginhost",
      DB_USER: "pluginhost",
      DB_PASSWORD: "s3cret",
    });
    expect(loadMigrateConfig().DB_PORT).toBe(5432);
  });
});

function captureConfigError(run: () => unknown): ConfigurationError {
  try {
    run();
  } catch (err) {
    expect(err).toBeInstanceOf(ConfigurationError);
    return err as ConfigurationError;
  }
  throw new Error("expected a ConfigurationError");
}
