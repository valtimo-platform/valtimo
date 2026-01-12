import type {Page, Response} from '@playwright/test';

export function waitForResponse(page: Page, method: string, url: string): Promise<Response> {
  return page.waitForResponse(response =>
    response.request().method() === method
    && response.url().includes(url)
    && response.status() >= 200
    && response.status() <= 299
  );
}
