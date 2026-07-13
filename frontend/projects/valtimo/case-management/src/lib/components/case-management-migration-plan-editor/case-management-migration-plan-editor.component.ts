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
  computed,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  BreadcrumbService,
  EditorModel,
  EditorModule,
  PageHeaderService,
  PageTitleService,
  RenderInPageHeaderDirective,
  SelectItem,
} from '@valtimo/components';
import {CaseManagementParams} from '@valtimo/shared';
import {ButtonModule, TabsModule} from 'carbon-components-angular';
import {map, Observable, Subscription, take} from 'rxjs';
import {
  CaseManagementService,
  CaseMigrationApiService,
  StartableItemApiService,
} from '../../services';
import {CASE_MANAGEMENT_MIGRATION_TEST_IDS} from '../../constants';
import {
  AddBuildingBlockInstruction,
  DataMigrationPatch,
  MigrationPlan,
  ProcessMigrationInstruction,
  RemoveBuildingBlockInstruction,
} from '../../models';
import {MigrationGeneralTabComponent} from './tabs/migration-general-tab.component';
import {MigrationDataMigrationTabComponent} from './tabs/migration-data-migration-tab.component';
import {MigrationProcessMigrationTabComponent} from './tabs/migration-process-migration-tab.component';
import {MigrationBuildingBlockTabComponent} from './tabs/migration-building-block-tab.component';

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
    RenderInPageHeaderDirective,
    MigrationGeneralTabComponent,
    MigrationDataMigrationTabComponent,
    MigrationProcessMigrationTabComponent,
    MigrationBuildingBlockTabComponent,
  ],
})
export class CaseManagementMigrationPlanEditorComponent implements OnInit, OnDestroy {
  protected readonly testIds = CASE_MANAGEMENT_MIGRATION_TEST_IDS;

  public readonly compactMode$ = this.pageHeaderService.compactMode$;

  public readonly $model = signal<EditorModel | null>(null);
  public readonly $plan = signal<MigrationPlan>({});
  public readonly $valid = signal<boolean>(false);
  public readonly $saving = signal<boolean>(false);
  public readonly $isEdit = signal<boolean>(false);
  public readonly $caseDefinitionKey = signal<string | null>(null);
  public readonly $caseDefinitionVersionTag = signal<string | null>(null);
  // Memoized so the data-migration value-path selectors get a stable context reference each render.
  public readonly $caseContext = computed(() => ({
    caseDefinitionKey: this.$caseDefinitionKey(),
    caseDefinitionVersionTag: this.$caseDefinitionVersionTag(),
  }));
  public readonly $runAfterOptions = signal<SelectItem[]>([]);
  // `key -> processDefinitionId` maps that scope the processMigration pickers AND drive the activity
  // lookups. A plan migrates FROM its predecessor (basedOnVersionTag) TO its own version, so the
  // source map holds the predecessor version's linked processes and the target map holds this one's.
  public readonly $sourceProcessDefs = signal<Record<string, string>>({});
  public readonly $targetProcessDefs = signal<Record<string, string>>({});
  // The plan's `key` identifies it and is required by the backend; a save without it fails, so
  // Save stays disabled until the JSON is valid, not already saving, and a non-blank key is present.
  public readonly $canSave = computed(() => {
    const key = this.$plan().key;
    return this.$valid() && !this.$saving() && typeof key === 'string' && key.trim().length > 0;
  });

  private _params!: CaseManagementParams;
  private _migrationKey: string | null = null;
  private _currentValue = '';
  private readonly _subscriptions = new Subscription();

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
    private readonly breadcrumbService: BreadcrumbService,
    private readonly pageHeaderService: PageHeaderService,
    private readonly pageTitleService: PageTitleService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly translateService: TranslateService,
    private readonly caseMigrationApiService: CaseMigrationApiService,
    private readonly startableItemApiService: StartableItemApiService,
    private readonly caseManagementService: CaseManagementService
  ) {
    this.pageTitleService.disableReset();
  }

  public ngOnInit(): void {
    const params = this.route.snapshot.params;
    this._params = {
      caseDefinitionKey: params['caseDefinitionKey'],
      caseDefinitionVersionTag: params['caseDefinitionVersionTag'],
    };
    this.$caseDefinitionKey.set(this._params.caseDefinitionKey);
    this.$caseDefinitionVersionTag.set(this._params.caseDefinitionVersionTag);
    this._migrationKey = params['migrationKey'] ?? null;

    this.initBreadcrumbs();
    this.loadRunAfterOptions();
    this.loadProcessKeys();

    if (this._migrationKey) {
      this.$isEdit.set(true);
      this.caseMigrationApiService
        .getPlanJson(this._params, this._migrationKey)
        .pipe(take(1))
        .subscribe(json => {
          this.setValue(JSON.stringify(json, null, 2));
          const title = typeof json['title'] === 'string' ? (json['title'] as string) : null;
          this.pageTitleService.setCustomPageTitle(title || this._migrationKey!);
        });
    } else {
      // stream() (not instant()) so a cold direct navigation, where translations may not be loaded
      // yet, still resolves the title instead of showing the raw key.
      this._subscriptions.add(
        this.translateService
          .stream('caseManagement.migration.editor.createTitle')
          .subscribe(title => this.pageTitleService.setCustomPageTitle(title))
      );
      // Start a new plan from a best-effort suggestion (data/process pre-filled),
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

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this.pageTitleService.enableReset();
    this.breadcrumbService.clearThirdBreadcrumb();
    this.breadcrumbService.clearFourthBreadcrumb();
  }

  /** Restore the case-definition + Migration-tab trail that this routed screen is nested under. */
  private initBreadcrumbs(): void {
    const route = `/case-management/case/${this._params.caseDefinitionKey}/version/${this._params.caseDefinitionVersionTag}`;

    this.breadcrumbService.setThirdBreadcrumb({
      route: [route],
      content: `${this._params.caseDefinitionKey} (${this._params.caseDefinitionVersionTag})`,
      href: route,
    });

    const migrationRoute = `${route}/migration`;

    // stream() so the label resolves even on a cold direct navigation (and follows language changes)
    // instead of freezing the raw translation key.
    this._subscriptions.add(
      this.translateService.stream('caseManagement.tabs.migration').subscribe(content =>
        this.breadcrumbService.setFourthBreadcrumb({
          route: [migrationRoute],
          content,
          href: migrationRoute,
        })
      )
    );
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

  public onAddBuildingBlockChange(
    instructions: (AddBuildingBlockInstruction | RemoveBuildingBlockInstruction)[]
  ): void {
    this.patchPlan({addBuildingBlock: instructions as AddBuildingBlockInstruction[]});
  }

  public onRemoveBuildingBlockChange(
    instructions: (AddBuildingBlockInstruction | RemoveBuildingBlockInstruction)[]
  ): void {
    this.patchPlan({removeBuildingBlock: instructions as RemoveBuildingBlockInstruction[]});
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

  /**
   * Scope the process pickers: the TARGET picker lists the processes linked to this (the plan's own)
   * case definition version; the SOURCE picker lists those linked to its predecessor
   * (`basedOnVersionTag`). When there is no predecessor the source resolves to this version too (§6.3),
   * so it falls back to the target's processes.
   */
  private loadProcessKeys(): void {
    this.linkedProcessDefinitions(this._params.caseDefinitionVersionTag)
      .pipe(take(1))
      .subscribe(defs => this.$targetProcessDefs.set(defs));

    this.caseManagementService
      .getCaseDefinition(this._params.caseDefinitionKey, this._params.caseDefinitionVersionTag)
      .pipe(take(1))
      .subscribe(definition => {
        const sourceVersion = definition?.basedOnVersionTag || this._params.caseDefinitionVersionTag;
        this.linkedProcessDefinitions(sourceVersion)
          .pipe(take(1))
          .subscribe(defs => this.$sourceProcessDefs.set(defs));
      });
  }

  /** `processKey -> processDefinitionId` for the processes linked to this case definition version. */
  private linkedProcessDefinitions(versionTag: string): Observable<Record<string, string>> {
    return this.startableItemApiService
      .getLinkedProcessDefinitions({
        caseDefinitionKey: this._params.caseDefinitionKey,
        caseDefinitionVersionTag: versionTag,
      })
      .pipe(
        map(links => {
          const defs: Record<string, string> = {};
          links.forEach(link => {
            const definition = link.processDefinition;
            if (definition?.key && definition?.id) defs[definition.key] = definition.id;
          });
          return defs;
        })
      );
  }

  private navigateBack(): void {
    this.router.navigateByUrl(
      `case-management/case/${this._params.caseDefinitionKey}/version/${this._params.caseDefinitionVersionTag}/migration`
    );
  }
}
