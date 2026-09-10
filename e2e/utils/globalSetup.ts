import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync, unlinkSync, existsSync } from 'fs';
import { Keycloak } from '../components/keycloak';
import { pinLanguage } from '../utils/settings';
import { generateOtp, millisUntilNextOtp } from './otp.utils';

export default async () => {
  console.log('[GLOBAL SETUP] Launching browser');

  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: process.env.qa_url ?? 'http://localhost:4200',
  });
  const page = await context.newPage();

  const authPath = 'playwright/.auth/admin.json';
  const tokenPath = 'playwright/.auth/accessToken.json';

  // Clean up any stale auth or token files
  if (existsSync(tokenPath)) {
    console.log('[GLOBAL SETUP] Removing stale token...');
    unlinkSync(tokenPath);
  }
  if (existsSync(authPath)) {
    console.log('[GLOBAL SETUP] Removing stale auth file...');
    unlinkSync(authPath);
  }

  /* ---------- 2. Obtain proper access token via direct grant ---------- */
  const keycloakUrl   = process.env.KEYCLOAK_URL   ?? 'http://localhost:8081';
  const keycloakRealm = process.env.KEYCLOAK_REALM ?? 'valtimo';

  const clientId     = process.env.KC_CLIENT_ID     ?? 'valtimo-console';
  const clientSecret = process.env.KC_CLIENT_SECRET ?? 'secret';

  // Basic form data
  const form: Record<string, string> = {
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'password',
    username: process.env.qa_admin_username ?? 'admin',
    password: process.env.qa_admin_password ?? 'admin',
    scope: 'openid',
  };

  // ----- Handle OTP (generate from otpauth URL only) -----
  if (process.env.qa_admin_otp_url) {
    form.otp = generateOtp(process.env.qa_admin_otp_url);
    console.log('[GLOBAL SETUP] Generated TOTP via otpauth URL:', form.otp);
  }

  const tokenResp = await page.request.post(
    `${keycloakUrl}/auth/realms/${keycloakRealm}/protocol/openid-connect/token`,
    {
      form,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
  );
  if (!tokenResp.ok()) {
    const errBody = await tokenResp.text();
    throw new Error(`[GLOBAL SETUP] Token request failed (${tokenResp.status()}): ${errBody}`);
  }

  const { access_token, refresh_token } = await tokenResp.json() as {
    access_token: string;
    refresh_token?: string;
  };

  if (!access_token) throw new Error('[GLOBAL SETUP] No access_token in response');

  process.env.PLAYWRIGHT_BEARER_TOKEN = access_token;

  if (refresh_token) {
    process.env.PLAYWRIGHT_REFRESH_TOKEN = refresh_token;
  }

  mkdirSync('playwright/.auth', { recursive: true });
  writeFileSync(
    tokenPath,
    JSON.stringify({ accessToken: access_token, refreshToken: refresh_token }, null, 2),
  );

  console.log('[GLOBAL SETUP] Access token (with roles) acquired ✅');

  // ---------- 3. Create browser storageState via Keycloak helper ----------
  console.log('[GLOBAL SETUP] Creating browser storage state (UI login)…');

  const keycloak = new Keycloak(page);
  await page.goto('/login'); // Ensure KC login page

  if (process.env.qa_admin_otp_url) {
    const waitMs = millisUntilNextOtp(process.env.qa_admin_otp_url);
    console.log(`[GLOBAL SETUP] Waiting ${Math.round(waitMs / 1000)}s for the next TOTP...`);
    await page.waitForTimeout(waitMs);
  }

  await keycloak.login(
    process.env.qa_admin_username ?? 'admin',
    process.env.qa_admin_password ?? 'admin',
    process.env.qa_admin_otp_url,
  );

  const appOrigin = new URL(process.env.qa_url ?? 'http://localhost:4200').origin;
  await page.waitForURL(
    url => url.origin === appOrigin && !url.pathname.startsWith('/keycloak'),
    { timeout: 60_000 }
  );
  await page.waitForLoadState('domcontentloaded');

  await pinLanguage(page, 'en');
  const uiStatePath = 'playwright/.auth/uiState.json';
  writeFileSync(uiStatePath, JSON.stringify(await context.storageState(), null, 2));
  console.log('[GLOBAL SETUP] storageState saved →', uiStatePath);

  await browser.close();
};
