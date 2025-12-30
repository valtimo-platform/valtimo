import {Page, expect} from '@playwright/test';
import type { Response } from '@playwright/test';

type ErrorAssertionOptions = {
  method: 'POST' | 'PUT' | 'DELETE';
  url: string;
  expectedStatus?: number;
  expectedErrorFragment?: string;
};

export async function expectApiError<T = unknown>(
  page: Page,
  options: ErrorAssertionOptions,
  action: () => Promise<T>
): Promise<void> {
  const { method, url, expectedStatus = 400, expectedErrorFragment } = options;

  const [actualResponse] = await Promise.all([
    page.waitForResponse((res) =>
      res.request().method() === method &&
      res.url().includes(url)
    ),
    action(),
  ]);

  const status = actualResponse.status();
  expect(status).toBe(expectedStatus);

  const body = await actualResponse.json().catch(() => ({}));
  if (expectedErrorFragment) {
    console.log('[API ERROR BODY]', body);
    console.log(JSON.stringify(body))
    expect(JSON.stringify(body)).toContain(expectedErrorFragment);
  }
}
