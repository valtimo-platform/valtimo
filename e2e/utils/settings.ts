import type { Page } from '@playwright/test';
import { apiGet, apiPut } from './api.utils';

export type LanguageCode = 'en' | 'nl' | 'de';

export async function setLanguage(languageCode: LanguageCode): Promise<void> {
  await apiPut('/api/v1/user/settings', { languageCode });
}

export async function getLanguage(): Promise<string | undefined> {
  const settings = await apiGet<{ languageCode?: string }>('/api/v1/user/settings');
  return settings?.languageCode;
}

const LANG_KEY_STORAGE_KEY = 'langKey';

export async function pinLanguage(
  page: Page,
  languageCode: LanguageCode,
  attempts = 5
): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await setLanguage(languageCode);
      await seedBootLanguage(page, languageCode);
      await reloadSettled(page);

      const bootLanguage = await page.evaluate(
        key => localStorage.getItem(key),
        LANG_KEY_STORAGE_KEY
      );
      if ((await getLanguage()) === languageCode && bootLanguage === languageCode) return;
    } catch (error) {
      if (!isNavigationRace(error)) throw error;
      await page.waitForLoadState('domcontentloaded').catch(() => undefined);
    }
  }

  throw new Error(`[settings] Language did not stay on "${languageCode}" after ${attempts} attempts`);
}

function isNavigationRace(error: unknown): boolean {
  return /Execution context was destroyed|frame was detached|net::ERR_ABORTED|Target closed|Navigation to/i.test(
    String(error)
  );
}

async function reloadSettled(page: Page): Promise<void> {
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    return;
  } catch (error) {
    if (!isNavigationRace(error)) throw error;
  }
  await page.waitForLoadState('domcontentloaded');
}

export async function seedBootLanguage(page: Page, languageCode: LanguageCode): Promise<void> {
  await page.evaluate(
    ([key, code]) => localStorage.setItem(key, code),
    [LANG_KEY_STORAGE_KEY, languageCode] as const
  );
}
