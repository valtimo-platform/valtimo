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

import {ViewType} from '@valtimo/components';
import {CaseMigrationCaseTableComponent} from './case-migration-case-table.component';

describe('CaseMigrationCaseTableComponent', () => {
  const ERRORS = Array.from({length: 23}, (_, index) => ({
    caseId: `case-${index + 1}`,
    message: `java.lang.IllegalStateException: refused ${index + 1}\n\tat Migrator.run`,
  })) as any[];

  const build = (): CaseMigrationCaseTableComponent =>
    new CaseMigrationCaseTableComponent(
      {showToast: () => {}} as any,
      {registerAll: () => {}} as any,
      {instant: (key: string) => key} as any
    );

  let component: CaseMigrationCaseTableComponent;

  beforeEach(() => {
    component = build();
    component.items = ERRORS;
  });

  it('pages the cases client-side, ten at a time', () => {
    expect(component.$view().items.length).toBe(10);
    expect(component.$view().pagination.collectionSize).toBe(23);

    component.onPageChange(3);

    expect(component.$view().items.map(item => item.caseId)).toEqual([
      'case-21',
      'case-22',
      'case-23',
    ]);
  });

  // The list's poll re-sets the items while the modal is open; that must not throw the author back to page 1.
  it('keeps the page when the items are refreshed', () => {
    component.onPageChange(3);

    component.items = [...ERRORS];

    expect(component.$page()).toBe(3);
  });

  it('expands and collapses one case stacktrace', () => {
    component.onToggleError(new Event('click'), 'case-1');
    expect(component.isErrorExpanded('case-1')).toBeTrue();
    expect(component.isErrorExpanded('case-2')).toBeFalse();

    component.onToggleError(new Event('click'), 'case-1');
    expect(component.isErrorExpanded('case-1')).toBeFalse();
  });

  // The live run and the dry run can refuse the same case; opening one stacktrace must not open the other.
  it('keeps its expanded stacktraces to itself', () => {
    const dryRun = build();
    dryRun.items = ERRORS;

    component.onToggleError(new Event('click'), 'case-1');

    expect(dryRun.isErrorExpanded('case-1')).toBeFalse();
  });

  it('summarises an error by its summary before its first stacktrace line', () => {
    expect(component.errorSummary({summary: 'Target process missing', message: 'x\ny'})).toBe(
      'Target process missing'
    );
    expect(component.errorSummary({summary: null, message: ERRORS[0].message})).toBe(
      'java.lang.IllegalStateException: refused 1'
    );
  });

  it('links no case without a case definition key', () => {
    expect(component.caseDetailLink('case-1')).toBeNull();

    component.caseDefinitionKey = 'verhuizing';

    expect(component.caseDetailLink('case-1')).toEqual([
      '/cases',
      'verhuizing',
      'document',
      'case-1',
    ]);
  });

  it('shows a warning message as plain text', () => {
    component.kind = 'warning';
    component.ngAfterViewInit();

    const message = component.$fields().find(field => field.key === 'message');
    expect(message?.viewType).toBe(ViewType.TEXT);
    expect(message?.label).toBe('caseManagement.migration.warnings.message');
  });
});
