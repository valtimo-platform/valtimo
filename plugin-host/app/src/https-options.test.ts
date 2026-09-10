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

import {mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import type {AppConfig} from "./models/index.js";
import {buildHttpsOptions} from "./https-options";

function configWith(tls: Partial<AppConfig>): AppConfig {
  return { ...tls } as AppConfig;
}

describe("buildHttpsOptions", () => {
  let dir: string;
  let certPath: string;
  let keyPath: string;
  let caPath: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "plugin-host-tls-"));
    certPath = join(dir, "cert.pem");
    keyPath = join(dir, "key.pem");
    caPath = join(dir, "ca.pem");
    writeFileSync(certPath, "CERT-BYTES");
    writeFileSync(keyPath, "KEY-BYTES");
    writeFileSync(caPath, "CA-BYTES");
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns undefined when neither cert nor key is configured (plain HTTP)", () => {
    expect(buildHttpsOptions(configWith({}))).toBeUndefined();
  });

  it("throws when only the cert is configured", () => {
    expect(() => buildHttpsOptions(configWith({ TLS_CERT_PATH: certPath }))).toThrow(
      /half-configured/
    );
  });

  it("throws when only the key is configured", () => {
    expect(() => buildHttpsOptions(configWith({ TLS_KEY_PATH: keyPath }))).toThrow(
      /half-configured/
    );
  });

  it("reads cert + key when both are configured", () => {
    const opts = buildHttpsOptions(configWith({ TLS_CERT_PATH: certPath, TLS_KEY_PATH: keyPath }));
    expect(opts?.cert?.toString()).toBe("CERT-BYTES");
    expect(opts?.key?.toString()).toBe("KEY-BYTES");
    expect(opts?.ca).toBeUndefined();
  });

  it("includes the CA chain when TLS_CA_PATH is set", () => {
    const opts = buildHttpsOptions(
      configWith({ TLS_CERT_PATH: certPath, TLS_KEY_PATH: keyPath, TLS_CA_PATH: caPath })
    );
    expect(opts?.ca?.toString()).toBe("CA-BYTES");
  });
});
