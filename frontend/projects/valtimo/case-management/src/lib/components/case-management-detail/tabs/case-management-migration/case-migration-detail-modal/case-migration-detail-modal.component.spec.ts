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
    component = new CaseMigrationDetailModalComponent(
      {showToast: () => {}} as any,
      {registerAll: () => {}} as any,
      {instant: (key: string) => key} as any
    );
  });

  // Start and Dry run close the modal without deselecting, so the same plan comes back on the next open.
  it('resets paging and expanded stacktraces when the same plan is reopened', () => {
    component.open = true;
    component.plan = PLAN;
    component.onErrorPageChange(3);
    component.onDryRunPageChange(2);
    component.onToggleError(new Event('click'), 'case-1');

    component.open = false;
    component.open = true;
    component.plan = PLAN;

    expect(component.$errorPage()).toBe(1);
    expect(component.$dryRunErrorPage()).toBe(1);
    expect(component.isErrorExpanded('case-1')).toBeFalse();
  });

  // The list's poll re-sets the plan while the modal is open; that must not throw the author back to page 1.
  it('keeps the page while the open plan is refreshed', () => {
    component.open = true;
    component.plan = PLAN;
    component.onErrorPageChange(3);

    component.plan = {...PLAN};

    expect(component.$errorPage()).toBe(3);
  });
});
