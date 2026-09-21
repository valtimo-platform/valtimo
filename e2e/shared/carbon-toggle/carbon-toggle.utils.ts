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

/**
 * Wrapper for Carbon's `cds-toggle`.
 *
 * Two things make these toggles awkward to drive from a test:
 *
 *  - The clickable target is not obvious. The underlying `role="switch"` input is
 *    rendered 1x1px and visually hidden, and clicking the `.cds--toggle__switch`
 *    graphic is a no-op in some Carbon versions. The reliable targets are the
 *    `cds-toggle` host itself and its `<label>`, so `set()` alternates between
 *    them until the state actually flips.
 *  - The initial state is data-driven (it reflects whatever the backend returned),
 *    so a blind `click()` toggles in an unknown direction. `set()` always reads
 *    the current state first and only clicks when a change is needed, which also
 *    makes it idempotent.
 */
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
    const targets = [this.host, this.host.locator('label').first()];
    let attempt = 0;

    await expect(async () => {
      if ((await this.isChecked()) !== checked) {
        await targets[attempt++ % targets.length].click();
      }
      expect(await this.isChecked()).toBe(checked);
    }).toPass({timeout: 15_000});
  }

  async enable() {
    await this.set(true);
  }

  async disable() {
    await this.set(false);
  }
}
