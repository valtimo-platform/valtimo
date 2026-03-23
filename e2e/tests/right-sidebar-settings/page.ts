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

import {type Page, expect} from '@playwright/test';
import {RIGHT_SIDEBAR_TEST_IDS} from '../../constants';

export class RightSidebarSettingsPage {
  readonly languageDropdown = this.page.getByTestId(RIGHT_SIDEBAR_TEST_IDS.languageDropdown);
  readonly themeDropdown = this.page.getByTestId(RIGHT_SIDEBAR_TEST_IDS.themeDropdown);

  constructor(private readonly page: Page) {}

  /**
   * Click the Settings tab in the right sidebar panel.
   * Carbon renders the actual [role="tab"] button separately from the <cds-tab> element.
   * The sidebar is positioned outside the viewport by design, so we use evaluate to click.
   */
  async goToSettingsTab() {
    const settingsTab = this.page.getByRole('tab', {name: 'Settings'});
    await settingsTab.evaluate(el => (el as HTMLElement).click());
    await expect(this.languageDropdown).toBeAttached();
  }

  /**
   * Select a language from the language dropdown.
   */
  async selectLanguage(languageName: string) {
    await this.languageDropdown.locator('button').evaluate(el => (el as HTMLElement).click());
    await this.page
      .getByRole('option', {name: languageName})
      .evaluate(el => (el as HTMLElement).click());
    // Wait for the UI to update after language change
    await this.page.waitForTimeout(1000);
  }

  /**
   * Get the currently selected language text from the dropdown.
   */
  async getSelectedLanguage(): Promise<string> {
    return await this.languageDropdown.locator('button').evaluate(el => el.textContent?.trim() ?? '');
  }

  /**
   * Select a theme from the theme dropdown.
   */
  async selectTheme(themeName: string) {
    await this.themeDropdown.locator('button').evaluate(el => (el as HTMLElement).click());
    await this.page
      .getByRole('option', {name: themeName})
      .evaluate(el => (el as HTMLElement).click());
    // Wait for the theme to apply
    await this.page.waitForTimeout(500);
  }

  /**
   * Get the currently selected theme text from the dropdown.
   */
  async getSelectedTheme(): Promise<string> {
    return await this.themeDropdown.locator('button').evaluate(el => el.textContent?.trim() ?? '');
  }

  /**
   * Get the active Carbon theme attribute from the body element.
   * Returns 'g10' for Light, 'g90' for Dark.
   */
  async getCarbonThemeAttribute(): Promise<string> {
    return await this.page.evaluate(
      () =>
        document.documentElement.getAttribute('data-carbon-theme') ||
        document.body.getAttribute('data-carbon-theme') ||
        '',
    );
  }

  /**
   * Assert that the navigation menu contains items with the expected language.
   */
  async assertNavigationLanguage(expectedItems: string[]) {
    const nav = this.page.getByRole('navigation', {name: 'Side navigation'});
    for (const item of expectedItems) {
      await expect(nav.getByText(item, {exact: true})).toBeAttached();
    }
  }
}
