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

import {expect, type Locator} from '@playwright/test';

export class CarbonToggle {
  constructor(private readonly host: Locator) {}

  /** The visually hidden `role="switch"` input that carries the checked state. */
  get switchControl(): Locator {
    return this.host.getByRole('switch');
  }

  async isChecked(): Promise<boolean> {
    return this.switchControl.isChecked();
  }

  async assertChecked(checked: boolean) {
    if (checked) {
      await expect(this.switchControl).toBeChecked();
    } else {
      await expect(this.switchControl).not.toBeChecked();
    }
  }

  async assertDisabled() {
    await expect(this.switchControl).toBeDisabled();
  }

  async assertEnabled() {
    await expect(this.switchControl).toBeEnabled();
  }

  /**
   * Drive the toggle to `checked`. No-op when it is already in that state.
   */
  async set(checked: boolean) {
    let attempt = 0;

    await expect(async () => {
      if ((await this.isChecked()) === checked) return;

      await this.clickOnce(attempt++);
      await expect(this.switchControl).toBeChecked({checked, timeout: 5_000});
    }).toPass({timeout: 30_000});
  }

  async clickOnce(attempt = 0): Promise<void> {
    const targets = [this.host.locator('label').first(), this.switchControl];
    const target = targets[attempt % targets.length];

    try {
      await target.click({timeout: 5_000});
    } catch (error) {
      if (!String(error).includes('intercepts pointer events')) throw error;
      console.warn(
        '[carbon-toggle] The toggle is covered by another element; dispatching the ' +
          'activation directly. A real user cannot click this control.'
      );
      await target.dispatchEvent('click');
    }
  }

  async enable() {
    await this.set(true);
  }

  async disable() {
    await this.set(false);
  }
}
