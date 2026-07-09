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
import {EditorModel, EditorModule, SelectItem} from '@valtimo/components';
import {CaseManagementParams} from '@valtimo/shared';
import {ButtonModule, TabsModule} from 'carbon-components-angular';
import {take} from 'rxjs';
import {CaseMigrationApiService} from '../../services';
import {CASE_MANAGEMENT_MIGRATION_TEST_IDS} from '../../constants';
import {DataMigrationPatch, MigrationPlan, ProcessMigrationInstruction} from '../../models';
import {MigrationGeneralTabComponent} from './tabs/migration-general-tab.component';
import {MigrationDataMigrationTabComponent} from './tabs/migration-data-migration-tab.component';
import {MigrationProcessMigrationTabComponent} from './tabs/migration-process-migration-tab.component';

@Component({
  standalone: true,
  selector: 'valtimo-case-management-migration-plan-editor',
  templateUrl: './case-management-migration-plan-editor.component.html',
  styleUrls: ['./case-management-migration-plan-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    EditorModule,
    ButtonModule,
    TabsModule,
    MigrationGeneralTabComponent,
    MigrationDataMigrationTabComponent,
    MigrationProcessMigrationTabComponent,
  ],
})
export class CaseManagementMigrationPlanEditorComponent implements OnInit {
  protected readonly testIds = CASE_MANAGEMENT_MIGRATION_TEST_IDS;

  public readonly $model = signal<EditorModel | null>(null);
  public readonly $plan = signal<MigrationPlan>({});
  public readonly $valid = signal<boolean>(false);
  public readonly $saving = signal<boolean>(false);
  public readonly $isEdit = signal<boolean>(false);
  public readonly $caseDefinitionKey = signal<string | null>(null);
  public readonly $caseDefinitionVersionTag = signal<string | null>(null);
  public readonly $runAfterOptions = signal<SelectItem[]>([]);
  public readonly $caseKeyOptions = signal<SelectItem[]>([]);
  public readonly $buildingBlockKeyOptions = signal<SelectItem[]>([]);

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
    this.$caseDefinitionKey.set(this._params.caseDefinitionKey);
    this.$caseDefinitionVersionTag.set(this._params.caseDefinitionVersionTag);
    this._migrationKey = params['migrationKey'] ?? null;

    this.loadRunAfterOptions();
    this.loadBlueprintOptions();

    if (this._migrationKey) {
      this.$isEdit.set(true);
      this.caseMigrationApiService
        .getPlanJson(this._params, this._migrationKey)
        .pipe(take(1))
        .subscribe(json => this.setValue(JSON.stringify(json, null, 2)));
    } else {
      // Start a new plan from a best-effort suggestion (source/target/data/process pre-filled),
      // falling back to the empty template if the backend can't produce one.
      this.setValue(this.NEW_PLAN_TEMPLATE);
      this.caseMigrationApiService
        .getPlanSuggestion(this._params)
        .pipe(take(1))
        .subscribe({
          next: suggestion => this.setValue(JSON.stringify(suggestion, null, 2)),
          error: () => {},
        });
    }
  }

  public onValid(valid: boolean): void {
    this.$valid.set(valid);
  }

  public onValueChange(value: string): void {
    this._currentValue = value;
    // Keep the form tabs in sync with manual JSON edits, but leave the editor model untouched
    // so the user's cursor is not reset while typing.
    const parsed = this.parse(value);
    if (parsed) this.$plan.set(parsed);
  }

  public onGeneralChange(general: Partial<MigrationPlan>): void {
    this.patchPlan(general);
  }

  public onDataMigrationChange(dataMigration: DataMigrationPatch[]): void {
    this.patchPlan({dataMigration});
  }

  public onProcessMigrationChange(processMigration: ProcessMigrationInstruction[]): void {
    this.patchPlan({processMigration});
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
    this.$plan.set(this.parse(value) ?? {});
  }

  /** Apply a structured change coming from one of the form tabs and reflect it in the JSON editor. */
  private patchPlan(partial: Partial<MigrationPlan>): void {
    const plan: MigrationPlan = {...this.$plan(), ...partial};
    const value = JSON.stringify(plan, null, 2);
    this._currentValue = value;
    this.$plan.set(plan);
    this.$model.set({value, language: 'json'});
    // A plan built from the form tabs is always structurally valid JSON.
    this.$valid.set(true);
  }

  private parse(value: string): MigrationPlan | null {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null ? (parsed as MigrationPlan) : null;
    } catch {
      return null;
    }
  }

  /** Load the other migration plans of this case definition version, so they can gate `runAfter`. */
  private loadRunAfterOptions(): void {
    this.caseMigrationApiService
      .getPlans(this._params)
      .pipe(take(1))
      .subscribe(plans =>
        this.$runAfterOptions.set(
          plans
            .filter(plan => plan.migrationKey !== this._migrationKey)
            .map(plan => ({id: plan.migrationKey, text: plan.title || plan.migrationKey}))
        )
      );
  }

  /** Load the case and building-block blueprint keys that can be picked as source/target. */
  private loadBlueprintOptions(): void {
    this.caseMigrationApiService
      .getCaseDefinitions()
      .pipe(take(1))
      .subscribe(items =>
        this.$caseKeyOptions.set(this.toKeyOptions(items.map(item => ({key: item.caseDefinitionKey, name: item.name}))))
      );

    this.caseMigrationApiService
      .getBuildingBlockDefinitions()
      .pipe(take(1))
      .subscribe(items =>
        this.$buildingBlockKeyOptions.set(this.toKeyOptions(items.map(item => ({key: item.key, name: item.name}))))
      );
  }

  /** Deduplicate blueprints by key (a key can have multiple versions) into select options. */
  private toKeyOptions(items: {key: string; name: string}[]): SelectItem[] {
    const byKey = new Map<string, string>();
    items.forEach(item => {
      if (!byKey.has(item.key)) byKey.set(item.key, item.name || item.key);
    });
    return Array.from(byKey, ([id, text]) => ({id, text}));
  }

  private navigateBack(): void {
    this.router.navigateByUrl(
      `case-management/case/${this._params.caseDefinitionKey}/version/${this._params.caseDefinitionVersionTag}/migration`
    );
  }
}
