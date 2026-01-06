import type {Locator, Page} from '@playwright/test';
import * as OTPAuth from "otpauth";

export class Keycloak {

  constructor(private readonly page: Page) {
  }

  async login(username: string, password: string, otpUrl?: string) {
    await this.page.fill('input[id="username"]', username);
    await this.page.fill('input[id="password"]', password);
    await this.page.click('button[id="kc-login"], input[id="kc-login"]')
    if (otpUrl && username !== 'admin') {
      // Wait until the OTP input is actually visible before generating the code,
      // so the TOTP is as fresh as possible.
      const otpInput = this.page.locator('input[id="otp"], input[name="otp"], input[id="totp"]');
      await otpInput.waitFor({ state: 'visible', timeout: 8000 });

      const totp = OTPAuth.URI.parse(otpUrl);
      const code  = totp.generate();                       // fresh 30‑sec TOTP
      await otpInput.fill(code);

      // Submit – Keycloak usually re‑uses the same kc‑login button
      const submit = this.page.locator('button[id="kc-login"], button[type="submit"], input[id="kc-login"]');
      await submit.click();

      // Small wait so we don't prematurely move on if Keycloak shows error
      // await this.page.waitForLoadState('networkidle');
    }
  }
}
