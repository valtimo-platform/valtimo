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
import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {EditorModule, RenderInPageHeaderDirective} from '@valtimo/components';
import {WarningFilled16} from '@carbon/icons';
import {
  ButtonModule,
  IconModule,
  IconService,
  NotificationModule,
  TabsModule,
} from 'carbon-components-angular';
import {MigrationPlanSummary} from '../../../models';
import {MigrationPlanEditorBaseComponent} from '../migration-plan-editor-base/migration-plan-editor-base.component';
import {MigrationBuildingBlockTabComponent} from '../migration-building-block-tab/migration-building-block-tab.component';
import {MigrationDataMigrationTabComponent} from '../migration-data-migration-tab/migration-data-migration-tab.component';
import {MigrationProcessMigrationTabComponent} from '../migration-process-migration-tab/migration-process-migration-tab.component';

/** The migration plan editor's chrome: the tab strip, every blueprint-agnostic tab, the JSON view and the header actions. The General tab is the one part each blueprint type builds itself, so it is projected in. */
@Component({
  standalone: true,
  selector: 'valtimo-migration-plan-editor-shell',
  templateUrl: './migration-plan-editor-shell.component.html',
  styleUrls: ['./migration-plan-editor-shell.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    EditorModule,
    ButtonModule,
    IconModule,
    NotificationModule,
    TabsModule,
    RenderInPageHeaderDirective,
    MigrationDataMigrationTabComponent,
    MigrationProcessMigrationTabComponent,
    MigrationBuildingBlockTabComponent,
  ],
})
export class MigrationPlanEditorShellComponent {
  /** The editor this chrome belongs to — one input rather than twenty, since every one of them would come from the same object. */
  @Input() public editor!: MigrationPlanEditorBaseComponent<unknown, MigrationPlanSummary>;

  constructor(private readonly iconService: IconService) {
    this.iconService.registerAll([WarningFilled16]);
  }
}
