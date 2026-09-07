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
 * Wrapper for `v-select` — Valtimo's dropdown, which renders a Carbon
 * `cds-combo-box` internally.
 *
 * The test id belongs on the `v-select` host, so the combo box and its input are
 * one level down. Options are only in the DOM while the box is open.
 */
export class VSelect {
  constructor(
    private readonly page: Page,
    private readonly host: Locator
  ) {}

  get comboBox(): Locator {
    return this.host.locator('cds-combo-box');
  }

  get input(): Locator {
    return this.host.locator('input');
  }

  get options(): Locator {
    return this.host.getByRole('option');
  }

  async open() {
    await this.comboBox.click();
    await expect(this.options.first()).toBeVisible();
  }

  async close() {
    await this.page.keyboard.press('Escape');
  }

  /** Labels the dropdown currently offers. */
  async optionLabels(): Promise<string[]> {
    await this.open();
    const labels = await this.options.allInnerTexts();
    await this.close();
    return labels.map(label => label.trim());
  }

  async selectByLabel(optionLabel: string) {
    await this.open();
    await this.options.getByText(optionLabel, {exact: true}).click();
    await expect(this.input).toHaveValue(optionLabel);
  }

  /** Select whichever option sits at `index` — useful when any valid value will do. */
  async selectByIndex(index: number): Promise<string> {
    await this.open();
    const option = this.options.nth(index);
    const label = (await option.innerText()).trim();
    await option.click();
    await expect(this.input).toHaveValue(label);
    return label;
  }

  async assertValue(expected: string) {
    await expect(this.input).toHaveValue(expected);
  }
}
