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

import { createHmac, createHash, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "x-valtimo-signature";
export const TIMESTAMP_HEADER = "x-valtimo-timestamp";

const ALGORITHM = "sha256";
const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Computes HMAC-SHA256 signature over the canonical request string.
 *
 * The payload format matches the backend's ExternalPluginHmacSigner:
 * `{METHOD}\n{path}\n{timestamp}\n{bodyHash}`
 */
export function computeSignature(
  secret: string,
  method: string,
  path: string,
  timestamp: string,
  bodyHash: string
): string {
  const payload = `${method.toUpperCase()}\n${path}\n${timestamp}\n${bodyHash}`;
  return createHmac(ALGORITHM, secret).update(payload, "utf8").digest("hex");
}

/**
 * Computes SHA-256 hash of the request body.
 */
export function computeBodyHash(body: Buffer): string {
  return createHash(ALGORITHM).update(body).digest("hex");
}

export interface HmacVerificationResult {
  valid: boolean;
  error?: string;
}

/**
 * Verifies the HMAC signature on an incoming request.
 *
 * Checks:
 * 1. Signature header is present
 * 2. Timestamp header is present and within acceptable drift
 * 3. Computed signature matches the provided signature (timing-safe comparison)
 */
export function verifyHmac(
  secret: string,
  method: string,
  path: string,
  signatureHeader: string | undefined,
  timestampHeader: string | undefined,
  body: Buffer
): HmacVerificationResult {
  if (!signatureHeader) {
    return { valid: false, error: "Missing signature header" };
  }

  if (!timestampHeader) {
    return { valid: false, error: "Missing timestamp header" };
  }

  // Validate timestamp is not too old or too far in the future (replay protection)
  const requestTime = Date.parse(timestampHeader);
  if (isNaN(requestTime)) {
    return { valid: false, error: "Invalid timestamp format" };
  }

  const now = Date.now();
  const drift = Math.abs(now - requestTime);
  if (drift > MAX_TIMESTAMP_DRIFT_MS) {
    return {
      valid: false,
      error: `Timestamp drift too large: ${Math.round(drift / 1000)}s (max ${MAX_TIMESTAMP_DRIFT_MS / 1000}s)`,
    };
  }

  const bodyHash = computeBodyHash(body);
  const expectedSignature = computeSignature(
    secret,
    method,
    path,
    timestampHeader,
    bodyHash
  );

  // Use timing-safe comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signatureHeader, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (sigBuffer.length !== expectedBuffer.length) {
    return { valid: false, error: "Invalid signature" };
  }

  if (!timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false, error: "Invalid signature" };
  }

  return { valid: true };
}
