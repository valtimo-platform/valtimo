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

  /**
   * The `role="switch"` button that carries the checked state. Carbon renders it with
   * `visually-hidden` (1x1px, `clip-path: inset(50%)`), so it can be read but never clicked —
   * a real click on it always fails hit testing.
   */
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
    // Park the pointer away so a tooltip from the previous interaction closes and stops eating clicks
    await this.host.page().mouse.move(0, 0);

    // Both targets are reachable. The visually hidden `role="switch"` button is not — a click on
    // it can only ever time out, so it is deliberately absent here.
    const targets = [this.host.locator('label').first(), this.host];
    const target = targets[attempt % targets.length];

    // A real click, hit testing included: a control a user cannot reach must fail the test.
    await target.click({timeout: 5_000});
  }

  async enable() {
    await this.set(true);
  }

  async disable() {
    await this.set(false);
  }
}
