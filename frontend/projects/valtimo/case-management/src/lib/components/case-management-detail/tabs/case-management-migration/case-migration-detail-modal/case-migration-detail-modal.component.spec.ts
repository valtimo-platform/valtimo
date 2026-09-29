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

import {CaseMigrationDetailModalComponent} from './case-migration-detail-modal.component';

describe('CaseMigrationDetailModalComponent', () => {
  let component: CaseMigrationDetailModalComponent;

  const PLAN = {
    migrationKey: 'plan-a',
    status: {errors: [], warnings: []},
    dryRun: {errors: [], warnings: []},
  } as any;

  beforeEach(() => {
    component = new CaseMigrationDetailModalComponent();
  });

  // Start and Dry run close the modal without deselecting, so the same plan comes back on the next open.
  it('keeps the plan across a close and reopen', () => {
    component.open = true;
    component.plan = PLAN;

    component.open = false;
    expect(component.$open()).toBeFalse();

    component.open = true;
    expect(component.$open()).toBeTrue();
    expect(component.$plan()).toBe(PLAN);
  });
});
