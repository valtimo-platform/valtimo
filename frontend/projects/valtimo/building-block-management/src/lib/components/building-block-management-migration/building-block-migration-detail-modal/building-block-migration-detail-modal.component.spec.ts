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

import {ComponentFixture, TestBed} from '@angular/core/testing';
import {TranslateModule} from '@ngx-translate/core';
import {BUILDING_BLOCK_MANAGEMENT_MIGRATION_TEST_IDS} from '../../../constants';
import {
  BuildingBlockMigrationDetailModalComponent,
  BuildingBlockMigrationPlanViewModel,
} from './building-block-migration-detail-modal.component';

describe('BuildingBlockMigrationDetailModalComponent', () => {
  let fixture: ComponentFixture<BuildingBlockMigrationDetailModalComponent>;

  const PLAN = {
    migrationKey: 'herinspectie',
    name: 'Herinspectie plannen',
    source: '1.0.0',
    target: '1.0.1',
    status: {status: 'NOT_STARTED', casesMigrated: 0},
  } as unknown as BuildingBlockMigrationPlanViewModel;

  const render = (plan: BuildingBlockMigrationPlanViewModel | null): HTMLElement => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('plan', plan);
    fixture.detectChanges();
    return fixture.nativeElement;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BuildingBlockMigrationDetailModalComponent, TranslateModule.forRoot()],
    });
    fixture = TestBed.createComponent(BuildingBlockMigrationDetailModalComponent);
  });

  it('emits closeEvent from the close button', () => {
    const closed = jasmine.createSpy('closed');
    fixture.componentInstance.closeEvent.subscribe(closed);
    const closeButton = render(PLAN).querySelector<HTMLButtonElement>(
      `[data-test-id="${BUILDING_BLOCK_MANAGEMENT_MIGRATION_TEST_IDS.detailModalCloseButton}"]`
    );

    closeButton!.click();

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('renders the plan name as its header', () => {
    expect(render(PLAN).querySelector('cds-modal-header')?.textContent).toContain(
      'Herinspectie plannen'
    );
  });

  it('renders no header without a plan', () => {
    expect(render(null).querySelector('cds-modal-header')).toBeNull();
  });
});
