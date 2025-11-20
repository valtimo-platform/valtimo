import type { Page } from '@playwright/test';
import { apiPut } from './api.utils';

/**
 * Set the UI language for the currently authenticated user.
 * Uses a Page instance to retrieve the token from context.
 */
export async function setLanguage(
  page: Page,
  languageCode: 'en' | 'nl' | 'de'
): Promise<void> {
  await apiPut('/api/v1/user/settings', { languageCode });
}
