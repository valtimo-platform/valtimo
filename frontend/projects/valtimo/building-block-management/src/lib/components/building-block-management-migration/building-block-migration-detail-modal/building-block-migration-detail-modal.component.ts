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

import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {ValtimoCdsModalDirective} from '@valtimo/components';
import {ButtonModule, LayerModule, ModalModule, TagModule} from 'carbon-components-angular';
import {BUILDING_BLOCK_MANAGEMENT_MIGRATION_TEST_IDS} from '../../../constants';
import {MigrationPlanManagement} from '../../../models';
import {migrationStatusTagType} from '../../../utils';

type BuildingBlockMigrationPlanViewModel = MigrationPlanManagement & {name: string};

/** One plan's status. Read-only: a building block plan is applied by the case migration that moves its block. */
@Component({
  standalone: true,
  selector: 'valtimo-building-block-migration-detail-modal',
  templateUrl: './building-block-migration-detail-modal.component.html',
  styleUrls: ['./building-block-migration-detail-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalModule,
    ButtonModule,
    TagModule,
    LayerModule,
    ValtimoCdsModalDirective,
    TranslateModule,
  ],
})
export class BuildingBlockMigrationDetailModalComponent {
  @Input() public open = false;
  @Input() public plan: BuildingBlockMigrationPlanViewModel | null = null;

  @Output() public readonly closeEvent = new EventEmitter<void>();

  protected readonly testIds = BUILDING_BLOCK_MANAGEMENT_MIGRATION_TEST_IDS;
  protected readonly statusTagType = migrationStatusTagType;
}

export {BuildingBlockMigrationPlanViewModel};
