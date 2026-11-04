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

import {expect, Locator, Page} from '@playwright/test';
import {CASE_MANAGEMENT_COLOR_TEST_IDS} from '../../constants';

/**
 * Wraps the color panel shared by the case definition General tab and the case group Config tab:
 * a preview, a palette of swatches (aria-label = uppercase hex) and a custom color picker.
 */
export class ColorPanel {
  constructor(private readonly page: Page) {}

  get panel(): Locator {
    return this.page.getByTestId(CASE_MANAGEMENT_COLOR_TEST_IDS.panel);
  }

  get swatches(): Locator {
    return this.panel.getByTestId(CASE_MANAGEMENT_COLOR_TEST_IDS.swatch);
  }

  get previewCircle(): Locator {
    return this.panel.getByTestId(CASE_MANAGEMENT_COLOR_TEST_IDS.previewCircle);
  }

  get previewHex(): Locator {
    return this.panel.getByTestId(CASE_MANAGEMENT_COLOR_TEST_IDS.previewHex);
  }

  get customPicker(): Locator {
    return this.panel.getByTestId(CASE_MANAGEMENT_COLOR_TEST_IDS.customPicker);
  }

  swatch(hex: string): Locator {
    return this.swatches.and(this.page.getByRole('button', {name: hex.toUpperCase(), exact: true}));
  }

  async swatchColors(): Promise<string[]> {
    await expect(this.swatches.first()).toBeVisible();
    return this.swatches.evaluateAll(buttons =>
      buttons.map(button => button.getAttribute('aria-label') ?? '')
    );
  }

  /** First swatch that is not the current color, so the click always changes something. */
  async pickDifferentColor(currentHex: string | null | undefined): Promise<string> {
    const colors = await this.swatchColors();
    const current = currentHex?.toUpperCase();
    const target = colors.find(color => color !== current);
    if (!target) throw new Error('No swatch differs from the current color');
    return target;
  }

  async assertSelected(hex: string): Promise<void> {
    const upper = hex.toUpperCase();
    await expect(this.previewHex).toHaveText(upper);
    await expect(this.swatch(upper)).toHaveAttribute('aria-pressed', 'true');
    await expect(this.swatches.and(this.page.locator('[aria-pressed="true"]'))).toHaveCount(1);
  }
}
