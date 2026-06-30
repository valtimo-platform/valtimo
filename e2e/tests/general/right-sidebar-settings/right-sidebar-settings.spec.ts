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

import {test, expect} from '@playwright/test';
import {RightSidebarSettingsPage} from './page';
import {apiPut} from '../../../utils/api.utils';

test.describe('Right sidebar settings', () => {
  let context, page;
  let settingsPage: RightSidebarSettingsPage;

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    settingsPage = new RightSidebarSettingsPage(page);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await settingsPage.goToSettingsTab();
  });

  test.afterAll(async () => {
    // Reset language to English and theme to Light for subsequent tests
    try {
      await apiPut('/api/v1/user/settings', {languageCode: 'en', preferredTheme: 'G10'});
    } catch {
      // Bearer token may have expired — the tests already restore both settings via UI
    }
    await context.close();
  });

  test.describe('Language switching', () => {
    test('can switch language to Nederlands', async () => {
      await settingsPage.selectLanguage('Nederlands');

      // Verify the dropdown now shows Nederlands
      const selectedLanguage = await settingsPage.getSelectedLanguage();
      expect(selectedLanguage).toContain('Nederlands');

      // Verify the navigation menu items switched to Dutch
      await settingsPage.assertNavigationLanguage(['Taken', 'Analyse']);
    });

    test('can switch language back to English', async () => {
      await settingsPage.selectLanguage('English');

      // Verify the dropdown now shows English
      const selectedLanguage = await settingsPage.getSelectedLanguage();
      expect(selectedLanguage).toContain('English');

      // Verify the navigation menu items switched back to English
      await settingsPage.assertNavigationLanguage(['Tasks', 'Analysis']);
    });
  });

  test.describe('Theme switching', () => {
    test('can switch to dark mode', async () => {
      await settingsPage.selectTheme('Dark');

      // Verify the dropdown shows the dark theme option
      const selectedTheme = await settingsPage.getSelectedTheme();
      expect(selectedTheme).toContain('Dark');

      // Verify the Carbon theme attribute changed to g90
      const themeAttr = await settingsPage.getCarbonThemeAttribute();
      expect(themeAttr).toBe('g90');
    });

    test('can switch back to light mode', async () => {
      await settingsPage.selectTheme('Light');

      // Verify the dropdown shows the light theme option
      const selectedTheme = await settingsPage.getSelectedTheme();
      expect(selectedTheme).toContain('Light');

      // Verify the Carbon theme attribute changed back to g10
      const themeAttr = await settingsPage.getCarbonThemeAttribute();
      expect(themeAttr).toBe('g10');
    });
  });
});
