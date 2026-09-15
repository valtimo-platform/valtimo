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

import * as OTPAuth from 'otpauth';

const NEW_WINDOW_MARGIN_MS = 1_000;

export function millisUntilNextOtp(otpUrl: string): number {
  const totp = OTPAuth.URI.parse(otpUrl) as OTPAuth.TOTP;
  const periodMs = totp.period * 1000;
  return periodMs - (Date.now() % periodMs) + NEW_WINDOW_MARGIN_MS;
}

export async function waitForNextOtp(otpUrl: string): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, millisUntilNextOtp(otpUrl)));
}

export function generateOtp(otpUrl: string): string {
  return OTPAuth.URI.parse(otpUrl).generate();
}
