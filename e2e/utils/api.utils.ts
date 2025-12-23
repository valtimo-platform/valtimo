// e2e/utils/api.utils.ts
import { request, APIRequestContext, APIResponse } from '@playwright/test';

let _context: APIRequestContext | undefined;

/**
 * create (or re‑use) a single Playwright APIRequestContext
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
    extraHTTPHeaders: {
      Authorization: `Bearer ${bearer}`,
      Accept: 'application/json',
    },
  });

  if (process.env.DEBUG_BEARER === '1') {
    const [, payloadB64] = bearer.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf-8'));
  }

  return _context;
}

/* ------------------------------------------------------------------ */
/*  Public helper wrappers                                            */
/* ------------------------------------------------------------------ */

export async function apiGet<T = unknown>(url: string): Promise<T> {
  const ctx = await getContext();
  const res = await ctx.get(url);
  await assertOk('GET', url, res);
  return (await res.json()) as T;
}

export async function apiPost<T = unknown>(
  url: string,
  body: unknown,
): Promise<T> {
  const ctx = await getContext();
  const res = await ctx.post(url, { data: body });
  await assertOk('POST', url, res);
  return (await res.json()) as T;
}

export async function apiPut<T = unknown>(
  url: string,
  body: unknown,
): Promise<T> {
  const ctx = await getContext();
  const res = await ctx.put(url, { data: body });
  await assertOk('PUT', url, res);
  const text = await res.text();
  if (!text) {
    return undefined as unknown as T;
  }
  return JSON.parse(text) as T;
}

export async function apiDelete(url: string): Promise<void> {
  const ctx = await getContext();
  const res = await ctx.delete(url);
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

async function assertOk(method: string, url: string, res: APIResponse) {
  if (res.ok()) return;
  const snippet = (await res.text()).slice(0, 120);
  throw new Error(`[api] ${method} ${url} → ${res.status()} | ${snippet}`);
}
