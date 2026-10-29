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

import {readFileSync} from "node:fs";
import type {ServerOptions as HttpsServerOptions} from "node:https";
import type {AppConfig} from "./models/index.js";

/**
 * Reads the TLS material when the host is configured to terminate HTTPS itself. Both the
 * certificate and key must be set together; supplying only one is a misconfiguration that would
 * otherwise silently fall back to plain HTTP, so it fails fast.
 */
export function buildHttpsOptions(config: AppConfig): HttpsServerOptions | undefined {
  const { TLS_CERT_PATH, TLS_KEY_PATH, TLS_CA_PATH } = config;
  if (!TLS_CERT_PATH && !TLS_KEY_PATH) {
    return undefined;
  }
  if (!TLS_CERT_PATH || !TLS_KEY_PATH) {
    throw new Error(
      "TLS is half-configured: set both TLS_CERT_PATH and TLS_KEY_PATH (PEM files), or neither."
    );
  }
  return {
    cert: readFileSync(TLS_CERT_PATH),
    key: readFileSync(TLS_KEY_PATH),
    ...(TLS_CA_PATH ? { ca: readFileSync(TLS_CA_PATH) } : {}),
  };
}
