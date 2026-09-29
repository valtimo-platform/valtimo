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

import {CommonModule} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {ValtimoCdsModalDirective} from '@valtimo/components';
import {ButtonModule, ModalModule, TagModule} from 'carbon-components-angular';
import {CASE_MANAGEMENT_MIGRATION_TEST_IDS} from '../../../../../constants';
import {MigrationPlanViewModel} from '../../../../../models';
import {migrationStatusTagType} from '@valtimo/building-block-management';
import {CaseMigrationCaseTableComponent} from '../case-migration-case-table/case-migration-case-table.component';

/** One plan's run: what it migrated, what it refused, and the same again for its latest dry run. The list behind it only says which plan to show. */
@Component({
  standalone: true,
  selector: 'valtimo-case-migration-detail-modal',
  templateUrl: './case-migration-detail-modal.component.html',
  styleUrls: ['./case-migration-detail-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ButtonModule,
    TagModule,
    ModalModule,
    ValtimoCdsModalDirective,
    CaseMigrationCaseTableComponent,
  ],
})
export class CaseMigrationDetailModalComponent {
  /** Start and Dry run close the modal without deselecting the plan, so the content is rendered only while open — see the template. */
  @Input() public set open(value: boolean) {
    this.$open.set(value);
  }

  /** Where a failed case's id links to. Null renders the id as plain text. */
  @Input() public caseDefinitionKey: string | null = null;

  /** The plan on show. Kept live by the list's poll, so this is re-set on every refresh. */
  @Input() public set plan(value: MigrationPlanViewModel | null) {
    this.$plan.set(value);
  }

  @Output() public readonly closeEvent = new EventEmitter<void>();
  @Output() public readonly startEvent = new EventEmitter<MigrationPlanViewModel>();
  @Output() public readonly dryRunEvent = new EventEmitter<MigrationPlanViewModel>();

  public readonly $open = signal<boolean>(false);
  public readonly $plan = signal<MigrationPlanViewModel | null>(null);

  protected readonly testIds = CASE_MANAGEMENT_MIGRATION_TEST_IDS;
  protected readonly statusTagType = migrationStatusTagType;

  public onClose(): void {
    this.closeEvent.emit();
  }
}
