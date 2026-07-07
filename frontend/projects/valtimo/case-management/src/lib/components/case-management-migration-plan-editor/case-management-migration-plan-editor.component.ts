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
import {ChangeDetectionStrategy, Component, OnInit, signal} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {EditorModel, EditorModule} from '@valtimo/components';
import {CaseManagementParams} from '@valtimo/shared';
import {ButtonModule, TabsModule} from 'carbon-components-angular';
import {take} from 'rxjs';
import {CaseMigrationApiService} from '../../services';
import {CASE_MANAGEMENT_MIGRATION_TEST_IDS} from '../../constants';

@Component({
  standalone: true,
  selector: 'valtimo-case-management-migration-plan-editor',
  templateUrl: './case-management-migration-plan-editor.component.html',
  styleUrls: ['./case-management-migration-plan-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule, EditorModule, ButtonModule, TabsModule],
})
export class CaseManagementMigrationPlanEditorComponent implements OnInit {
  protected readonly testIds = CASE_MANAGEMENT_MIGRATION_TEST_IDS;

  public readonly $model = signal<EditorModel | null>(null);
  public readonly $valid = signal<boolean>(false);
  public readonly $saving = signal<boolean>(false);
  public readonly $isEdit = signal<boolean>(false);

  private _params!: CaseManagementParams;
  private _migrationKey: string | null = null;
  private _currentValue = '';

  private readonly NEW_PLAN_TEMPLATE = JSON.stringify(
    {
      title: '',
      key: '',
      migrationTriggers: {triggeredByButton: true},
      conditions: [],
      dataMigration: [],
      processMigration: [],
    },
    null,
    2
  );

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly caseMigrationApiService: CaseMigrationApiService
  ) {}

  public ngOnInit(): void {
    const params = this.route.snapshot.params;
    this._params = {
      caseDefinitionKey: params['caseDefinitionKey'],
      caseDefinitionVersionTag: params['caseDefinitionVersionTag'],
    };
    this._migrationKey = params['migrationKey'] ?? null;

    if (this._migrationKey) {
      this.$isEdit.set(true);
      this.caseMigrationApiService
        .getPlanJson(this._params, this._migrationKey)
        .pipe(take(1))
        .subscribe(json => this.setValue(JSON.stringify(json, null, 2)));
    } else {
      this.setValue(this.NEW_PLAN_TEMPLATE);
    }
  }

  public onValid(valid: boolean): void {
    this.$valid.set(valid);
  }

  public onValueChange(value: string): void {
    this._currentValue = value;
  }

  public onSave(): void {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(this._currentValue);
    } catch {
      return;
    }

    this.$saving.set(true);
    this.caseMigrationApiService.savePlan(this._params, parsed).subscribe({
      next: () => this.navigateBack(),
      error: () => this.$saving.set(false),
    });
  }

  public onCancel(): void {
    this.navigateBack();
  }

  private setValue(value: string): void {
    this._currentValue = value;
    this.$model.set({value, language: 'json'});
  }

  private navigateBack(): void {
    this.router.navigateByUrl(
      `case-management/case/${this._params.caseDefinitionKey}/version/${this._params.caseDefinitionVersionTag}/migration`
    );
  }
}
