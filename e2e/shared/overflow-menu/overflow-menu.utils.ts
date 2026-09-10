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

import {expect, type Locator, type Page} from '@playwright/test';

/**
 * Wrapper for the Valtimo `v-overflow-menu` component (the "More" menus in
 * admin detail headers and carbon-list rows).
 *
 * The menu content is rendered in an overlay outside the trigger, so options are
 * looked up page-wide rather than inside the trigger element. Options are only
 * present in the DOM while the menu is open.
 */
export class OverflowMenu {
  constructor(
    private readonly page: Page,
    private readonly triggerTestId: string
  ) {}

  get trigger(): Locator {
    return this.page.getByTestId(this.triggerTestId);
  }

  get menu(): Locator {
    return this.page.getByRole('menu');
  }

  option(optionTestId: string): Locator {
    return this.page.getByTestId(optionTestId);
  }

  async open() {
    await expect(this.trigger).toBeEnabled();
    await this.trigger.click();
    await expect(this.menu).toBeVisible();
  }

  async close() {
    await this.page.keyboard.press('Escape');
    await expect(this.menu).not.toBeVisible();
  }

  /** Open the menu and click one of its options. */
  async selectOption(optionTestId: string) {
    await this.open();
    const option = this.option(optionTestId);
    await expect(option).toBeVisible();
    await option.click();
  }

  /** Labels of the options currently offered, in render order. */
  async optionLabels(): Promise<string[]> {
    const labels = await this.menu.getByRole('menuitem').allInnerTexts();
    return labels.map(label => label.trim());
  }
}
