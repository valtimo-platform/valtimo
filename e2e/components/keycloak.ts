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

import {expect, type Page} from '@playwright/test';
import {generateOtp, waitForNextOtp} from '../utils/otp.utils';

const KEYCLOAK_PATH = /\/realms\//;

export class Keycloak {

  constructor(private readonly page: Page) {
  }

  async login(username: string, password: string, otpUrl?: string) {
    await this.page.fill('input[id="username"]', username);
    await this.page.fill('input[id="password"]', password);
    await this.page.click('button[id="kc-login"], input[id="kc-login"]')

    if (!otpUrl || username === 'admin') return;

    const otpInput = this.page.locator('input[id="otp"], input[name="otp"], input[id="totp"]');
    const submit = this.page
      .locator('button[id="kc-login"], button[type="submit"], input[id="kc-login"]')
      .first();
    const rejected = this.page.locator(
      '.alert-error, .kc-feedback-text, #input-error-otp-code, #input-error-otp'
    );

    await expect
      .poll(async () => (await otpInput.isVisible()) || !this.onKeycloak(), {timeout: 60_000})
      .toBe(true);

    for (let attempt = 1; attempt <= 3; attempt++) {
      if (!(await otpInput.isVisible())) return;
      if (attempt > 1) await waitForNextOtp(otpUrl);

      await otpInput.fill(generateOtp(otpUrl));
      await submit.click();

      await expect
        .poll(async () => !this.onKeycloak() || (await rejected.isVisible()), {timeout: 30_000})
        .toBe(true);

      if (!this.onKeycloak()) return;
    }

    throw new Error('[keycloak] The one-time code was rejected on every attempt');
  }

  private onKeycloak(): boolean {
    try {
      return KEYCLOAK_PATH.test(new URL(this.page.url()).pathname);
    } catch {
      return false;
    }
  }
}
