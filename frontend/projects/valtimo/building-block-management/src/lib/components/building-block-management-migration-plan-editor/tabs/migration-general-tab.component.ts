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
import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {SelectItem} from '@valtimo/components';
import {BUILDING_BLOCK_MANAGEMENT_MIGRATION_TEST_IDS} from '../../../constants';
import {MigrationPlan} from '../../../models';
import {
  GeneralFieldsValue,
  MigrationGeneralFieldsComponent,
} from '../../migration-plan-editor/tabs/migration-general-fields.component';

/**
 * The General tab of a *building block* migration plan: the shared identity + source fields, plus an
 * explanation of when the plan runs.
 *
 * That explanation is all a building block plan has where a case plan has triggers and conditions. It
 * has no lifecycle of its own — it is applied by the case migration that moves its building block onto
 * this version — so declaring either is refused at deploy time, and neither belongs on this form.
 */
@Component({
  standalone: true,
  selector: 'valtimo-bb-migration-general-tab',
  templateUrl: './migration-general-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule, MigrationGeneralFieldsComponent],
})
export class BbMigrationGeneralTabComponent {
  @Input() public buildingBlockDefinitionKey: string | null = null;
  @Input() public buildingBlockDefinitionVersionTag: string | null = null;
  /** The building blocks a plan may migrate instances from — any key, not just this one. */
  @Input() public sourceKeyOptions: SelectItem[] = [];
  /** The versions of the currently selected source key. */
  @Input() public sourceVersionOptions: SelectItem[] = [];
  /** The migration keys this building block version already has, so a generated key stays unique. */
  @Input() public usedKeys: string[] = [];
  @Input() public suggesting = false;
  @Input() public isEdit = false;

  @Input() public set plan(value: MigrationPlan | null | undefined) {
    this.fields = {
      title: value?.title ?? '',
      key: value?.key ?? '',
      source: value?.source ?? {},
    };
  }

  @Output() public readonly generalChange = new EventEmitter<Partial<MigrationPlan>>();

  protected readonly testIds = BUILDING_BLOCK_MANAGEMENT_MIGRATION_TEST_IDS;

  public fields: GeneralFieldsValue = {title: '', key: '', source: {}};

  public onFieldsChange(value: GeneralFieldsValue): void {
    this.generalChange.emit({...value});
  }
}
