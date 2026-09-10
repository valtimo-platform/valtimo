// e2e/utils/api.utils.ts
import { request, APIRequestContext, APIResponse } from '@playwright/test';
import {generateOtp, waitForNextOtp} from './otp.utils';

let _context: APIRequestContext | undefined;

async function fetchFreshToken(): Promise<string> {
  const keycloakUrl = process.env.KEYCLOAK_URL ?? 'http://localhost:8081';
  const keycloakRealm = process.env.KEYCLOAK_REALM ?? 'valtimo';
  const tokenUrl = `${keycloakUrl}/auth/realms/${keycloakRealm}/protocol/openid-connect/token`;
  const clientId = process.env.KC_CLIENT_ID ?? 'valtimo-console';
  const clientSecret = process.env.KC_CLIENT_SECRET ?? 'secret';

  async function postToken(form: Record<string, string>) {
    const ctx = await request.newContext();
    const resp = await ctx.post(tokenUrl, {
      form,
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    });
    const ok = resp.ok();
    const status = resp.status();
    const body = ok ? await resp.json() : await resp.text();
    await ctx.dispose();
    return {ok, status, body} as {ok: boolean; status: number; body: any};
  }

  const refreshToken = process.env.PLAYWRIGHT_REFRESH_TOKEN;
  if (refreshToken) {
    const r = await postToken({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    if (r.ok) {
      if (r.body.refresh_token) process.env.PLAYWRIGHT_REFRESH_TOKEN = r.body.refresh_token;
      return r.body.access_token as string;
    }
    // Refresh token rejected (expired/revoked). Drop it and fall through.
    delete process.env.PLAYWRIGHT_REFRESH_TOKEN;
  }

  const form: Record<string, string> = {
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'password',
    username: process.env.qa_admin_username ?? 'admin',
    password: process.env.qa_admin_password ?? 'admin',
    scope: 'openid',
  };
  const otpUrl = process.env.qa_admin_otp_url;
  if (otpUrl) form.otp = generateOtp(otpUrl);

  let r = await postToken(form);

  if (!r.ok && otpUrl) {
    await waitForNextOtp(otpUrl);
    form.otp = generateOtp(otpUrl);
    r = await postToken(form);
  }

  if (!r.ok) {
    throw new Error(`[api] Token refresh failed (${r.status}): ${String(r.body).slice(0, 120)}`);
  }
  if (r.body.refresh_token) process.env.PLAYWRIGHT_REFRESH_TOKEN = r.body.refresh_token;
  return r.body.access_token as string;
}

/**
 * Create (or re‑use) a single Playwright APIRequestContext
 * with the bearer token fetched in globalSetup.
 */
async function getContext(): Promise<APIRequestContext> {
  if (_context) return _context;

  const bearer = process.env.PLAYWRIGHT_BEARER_TOKEN;
  if (!bearer) {
    throw new Error('[api] PLAYWRIGHT_BEARER_TOKEN is missing – did globalSetup run?');
  }
  _context = await request.newContext({
    baseURL: process.env.qa_url ?? 'http://localhost:8080',
    timeout: 90_000,
    extraHTTPHeaders: {
      Authorization: `Bearer ${bearer}`,
      Accept: 'application/json, text/plain, */*',
    },
  });

  return _context;
}

async function refreshContext(): Promise<APIRequestContext> {
  if (_context) await _context.dispose();
  _context = undefined;

  const freshToken = await fetchFreshToken();
  process.env.PLAYWRIGHT_BEARER_TOKEN = freshToken;

  _context = await request.newContext({
    baseURL: process.env.qa_url ?? 'http://localhost:8080',
    timeout: 90_000,
    extraHTTPHeaders: {
      Authorization: `Bearer ${freshToken}`,
      Accept: 'application/json, text/plain, */*',
    },
  });

  return _context;
}

/* ------------------------------------------------------------------ */
/*  Public helper wrappers                                            */
/* ------------------------------------------------------------------ */

export async function apiGet<T = unknown>(url: string): Promise<T> {
  let ctx = await getContext();
  let res = await send('GET', () => ctx.get(url));
  if (res.status() === 401) {
    ctx = await refreshContext();
    res = await send('GET', () => ctx.get(url));
  }
  await assertOk('GET', url, res);
  return (await res.json()) as T;
}

export async function apiPost<T = unknown>(
  url: string,
  body: unknown,
): Promise<T> {
  let ctx = await getContext();
  let res = await send('POST', () => ctx.post(url, { data: body }));
  if (res.status() === 401) {
    ctx = await refreshContext();
    res = await send('POST', () => ctx.post(url, { data: body }));
  }
  await assertOk('POST', url, res);
  return (await res.json()) as T;
}

export async function apiPut<T = unknown>(
  url: string,
  body: unknown,
): Promise<T> {
  let ctx = await getContext();
  let res = await send('PUT', () => ctx.put(url, { data: body }));
  if (res.status() === 401) {
    ctx = await refreshContext();
    res = await send('PUT', () => ctx.put(url, { data: body }));
  }
  await assertOk('PUT', url, res);
  const text = await res.text();
  if (!text) {
    return undefined as unknown as T;
  }
  return JSON.parse(text) as T;
}

export async function apiPatch<T = unknown>(
  url: string,
  body: unknown,
): Promise<T> {
  let ctx = await getContext();
  let res = await send('PATCH', () => ctx.patch(url, { data: body }));
  if (res.status() === 401) {
    ctx = await refreshContext();
    res = await send('PATCH', () => ctx.patch(url, { data: body }));
  }
  await assertOk('PATCH', url, res);
  const text = await res.text();
  if (!text) {
    return undefined as unknown as T;
  }
  return JSON.parse(text) as T;
}

export async function apiDelete(url: string): Promise<void> {
  let ctx = await getContext();
  let res = await send('DELETE', () => ctx.delete(url));
  if (res.status() === 401) {
    ctx = await refreshContext();
    res = await send('DELETE', () => ctx.delete(url));
  }
  await assertOk('DELETE', url, res);
}

/* ------------------------------------------------------------------ */
/*  Dispose helper ‑ call once in globalTeardown                      */
/* ------------------------------------------------------------------ */

export async function disposeApi(): Promise<void> {
  if (_context) await _context.dispose();
  _context = undefined;
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                  */
/* ------------------------------------------------------------------ */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isApiStatus(error: unknown, status: number): boolean {
  return error instanceof ApiError && error.status === status;
}

const UNSENT_REQUEST_ERROR = /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|EHOSTUNREACH/i;

const DROPPED_CONNECTION_ERROR = /ECONNRESET|ETIMEDOUT|socket hang up|network error/i;

const IDEMPOTENT_METHODS = new Set(['GET', 'PUT', 'DELETE']);

async function send(
  method: string,
  request: () => Promise<APIResponse>
): Promise<APIResponse> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await request();
    } catch (error) {
      const message = String(error);
      const retryable =
        UNSENT_REQUEST_ERROR.test(message) ||
        (IDEMPOTENT_METHODS.has(method) && DROPPED_CONNECTION_ERROR.test(message));

      if (attempt === 3 || !retryable) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 1_000));
    }
  }
}

async function assertOk(method: string, url: string, res: APIResponse) {
  if (res.ok()) return;
  const snippet = (await res.text()).slice(0, 120);
  throw new ApiError(res.status(), `[api] ${method} ${url} → ${res.status()} | ${snippet}`);
}
