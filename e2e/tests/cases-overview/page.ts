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

import {expect, Locator, Page, Response} from '@playwright/test';
import {CASE_MENU_TEST_IDS, CASE_OVERVIEW_TEST_IDS, LEFT_SIDEBAR_TEST_IDS} from '../../constants';
import {PINNED_ITEM_ENDPOINT} from '../../utils/case-group.utils';

export const PIN_INFO_DISMISSED_KEY = 'caseOverviewPinInfoDismissed';

export class CasesOverviewPage {
  constructor(private readonly page: Page) {}

  async goTo() {
    await this.page.goto('/cases-overview');
    await expect(this.typesSection).toBeVisible();
    await expect(this.typeRows.first()).toBeVisible();
    await this.expandCasesMenu();
  }

  // ─── Overview ─────────────────────────────────────────────────────

  get searchInput(): Locator {
    return this.page.getByTestId(CASE_OVERVIEW_TEST_IDS.search).getByRole('textbox');
  }

  get pinInfoNotification(): Locator {
    return this.page.getByTestId(CASE_OVERVIEW_TEST_IDS.pinInfoNotification);
  }

  get pinInfoCloseButton(): Locator {
    return this.pinInfoNotification.getByRole('button', {name: 'Close alert notification'});
  }

  get groupsSection(): Locator {
    return this.page.getByTestId(CASE_OVERVIEW_TEST_IDS.groupsSection);
  }

  get groupsCount(): Locator {
    return this.page.getByTestId(CASE_OVERVIEW_TEST_IDS.groupsCount);
  }

  get groupTiles(): Locator {
    return this.page.getByTestId(CASE_OVERVIEW_TEST_IDS.groupTile);
  }

  groupTile(title: string): Locator {
    return this.groupTiles.filter({
      has: this.page.getByRole('heading', {name: title, exact: true}),
    });
  }

  groupPinButton(title: string): Locator {
    return this.groupTile(title).getByTestId(CASE_OVERVIEW_TEST_IDS.groupPinButton);
  }

  groupOpenLink(title: string): Locator {
    return this.groupTile(title).getByTestId(CASE_OVERVIEW_TEST_IDS.groupOpenLink);
  }

  get groupsNoResults(): Locator {
    return this.page.getByTestId(CASE_OVERVIEW_TEST_IDS.groupsNoResults);
  }

  get typesSection(): Locator {
    return this.page.getByTestId(CASE_OVERVIEW_TEST_IDS.typesSection);
  }

  get typesCount(): Locator {
    return this.page.getByTestId(CASE_OVERVIEW_TEST_IDS.typesCount);
  }

  get typeRows(): Locator {
    return this.page.getByTestId(CASE_OVERVIEW_TEST_IDS.typeRow);
  }

  typeRow(name: string): Locator {
    return this.typeRows.filter({
      has: this.page.getByTestId(CASE_OVERVIEW_TEST_IDS.typeLink).getByText(name, {exact: true}),
    });
  }

  typeLink(name: string): Locator {
    return this.typeRow(name).getByTestId(CASE_OVERVIEW_TEST_IDS.typeLink);
  }

  typePinButton(name: string): Locator {
    return this.typeRow(name).getByTestId(CASE_OVERVIEW_TEST_IDS.typePinButton);
  }

  get typesNoResults(): Locator {
    return this.page.getByTestId(CASE_OVERVIEW_TEST_IDS.typesNoResults);
  }

  async groupTitles(): Promise<string[]> {
    return (await this.groupTiles.getByRole('heading', {level: 4}).allInnerTexts()).map(t =>
      t.trim()
    );
  }

  async typeNames(): Promise<string[]> {
    return (await this.page.getByTestId(CASE_OVERVIEW_TEST_IDS.typeLink).allInnerTexts()).map(t =>
      t.trim()
    );
  }

  async search(text: string) {
    await this.searchInput.fill(text);
  }

  /** Clicks a pin button and waits for the pin or unpin request it sends. */
  async togglePin(button: Locator, method: 'POST' | 'DELETE'): Promise<Response> {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          res.request().method() === method &&
          new URL(res.url()).pathname.startsWith(PINNED_ITEM_ENDPOINT)
      ),
      button.click(),
    ]);
    return response;
  }

  async assertPinned(button: Locator, pinned: boolean) {
    await expect(button).toHaveAttribute('aria-pressed', String(pinned));
    await expect(button).toHaveAccessibleName(pinned ? 'Unpin from sidebar' : 'Pin to sidebar');
  }

  toast(text: string): Locator {
    return this.page.getByRole('status').or(this.page.getByRole('alert')).filter({hasText: text});
  }

  // ─── Sidebar ──────────────────────────────────────────────────────

  get casesMenu(): Locator {
    return this.page.getByTestId(CASE_MENU_TEST_IDS.casesMenu);
  }

  get casesMenuTitle(): Locator {
    return this.casesMenu
      .getByRole('button', {name: 'Cases', exact: true})
      .getByText('Cases', {exact: true});
  }

  get casesMenuChevron(): Locator {
    return this.casesMenu.getByTestId(LEFT_SIDEBAR_TEST_IDS.submenuChevron);
  }

  get casesMenuToggle(): Locator {
    return this.casesMenu.locator('button[aria-haspopup="true"]');
  }

  // Only the chevron expands the menu; it starts collapsed on every load.
  async expandCasesMenu() {
    await expect(this.casesMenuToggle).toBeVisible();
    if ((await this.casesMenuToggle.getAttribute('aria-expanded')) !== 'true') {
      await this.casesMenuChevron.click();
    }
    await expect(this.casesMenuToggle).toHaveAttribute('aria-expanded', 'true');
  }

  get pinnedMenuItems(): Locator {
    return this.casesMenu.getByTestId(CASE_MENU_TEST_IDS.pinnedItem);
  }

  pinnedMenuItem(name: string): Locator {
    return this.pinnedMenuItems.filter({hasText: name});
  }

  get pinPlaceholder(): Locator {
    return this.casesMenu.getByTestId(CASE_MENU_TEST_IDS.pinPlaceholder);
  }

  async pinnedMenuNames(): Promise<string[]> {
    return (await this.pinnedMenuItems.allInnerTexts()).map(name => name.trim());
  }

  async assertCasesSectionActive(active: boolean) {
    const assertion = expect(this.casesMenu);
    if (active) await assertion.toHaveClass(/menu-item--section-active/);
    else await assertion.not.toHaveClass(/menu-item--section-active/);
  }

  async clearPinInfoDismissal() {
    await this.page.evaluate(key => localStorage.removeItem(key), PIN_INFO_DISMISSED_KEY);
  }
}
