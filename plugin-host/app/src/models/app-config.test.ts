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

import {hostname} from "node:os";
import {describe, expect, it} from "vitest";
import {envSchema} from "./app-config";

describe("envSchema", () => {
  it("requires ADMIN_TOKEN", () => {
    expect(() => envSchema.parse({})).toThrow();
    expect(() => envSchema.parse({ ADMIN_TOKEN: "" })).toThrow();
  });

  it("applies defaults when only ADMIN_TOKEN is supplied", () => {
    const cfg = envSchema.parse({ ADMIN_TOKEN: "secret" });
    expect(cfg.PORT).toBe(8090);
    expect(cfg.PLUGIN_STORAGE_DIR).toBe("./plugins");
    expect(cfg.LOG_LEVEL).toBe("info");
    // The host DB defaults to 5434, not the standard 5432.
    expect(cfg.DB_PORT).toBe(5434);
    expect(cfg.DB_NAME).toBe("pluginhost");
  });

  it("defaults HOST_ID to the OS hostname", () => {
    const cfg = envSchema.parse({ ADMIN_TOKEN: "secret" });
    expect(cfg.HOST_ID).toBe(hostname());
  });

  it("honours an explicit HOST_ID", () => {
    const cfg = envSchema.parse({ ADMIN_TOKEN: "secret", HOST_ID: "host-a" });
    expect(cfg.HOST_ID).toBe("host-a");
  });

  it("coerces numeric env strings for PORT and DB_PORT", () => {
    const cfg = envSchema.parse({ ADMIN_TOKEN: "secret", PORT: "9000", DB_PORT: "6000" });
    expect(cfg.PORT).toBe(9000);
    expect(cfg.DB_PORT).toBe(6000);
  });

  it("rejects an out-of-enum LOG_LEVEL", () => {
    expect(() => envSchema.parse({ ADMIN_TOKEN: "secret", LOG_LEVEL: "trace" })).toThrow();
  });

  it("leaves TLS paths undefined when not set", () => {
    const cfg = envSchema.parse({ ADMIN_TOKEN: "secret" });
    expect(cfg.TLS_CERT_PATH).toBeUndefined();
    expect(cfg.TLS_KEY_PATH).toBeUndefined();
    expect(cfg.TLS_CA_PATH).toBeUndefined();
  });
});
