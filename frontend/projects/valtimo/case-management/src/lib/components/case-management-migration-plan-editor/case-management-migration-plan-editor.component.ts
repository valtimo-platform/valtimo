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
  ValuePathSelectorPrefix,
} from '@valtimo/components';
import {CaseManagementParams} from '@valtimo/shared';
import {WarningFilled16} from '@carbon/icons';
import {ButtonModule, IconModule, IconService, TabsModule} from 'carbon-components-angular';
import {finalize, map, Observable, Subscription, take} from 'rxjs';
import {
  CaseManagementService,
  CaseMigrationApiService,
  StartableItemApiService,
} from '../../services';
import {CASE_MANAGEMENT_MIGRATION_TEST_IDS} from '../../constants';
import {
  AddBuildingBlockInstruction,
  BuildingBlockEntryOwner,
  DataMigrationPatch,
  MigrationEditorApi,
  MigrationPlan,
  MigrationPlanSource,
  ProcessMigrationInstruction,
  RemoveBuildingBlockInstruction,
} from '../../models';
import {
  MigrationBuildingBlockTabComponent,
  MigrationDataMigrationTabComponent,
  MigrationProcessMigrationTabComponent,
} from '@valtimo/building-block-management';
import {MigrationGeneralTabComponent} from './tabs/migration-general-tab.component';

import {
  asPlanText,
  parsePlan,
  sourceIdOf,
  unmappedProcessesIn,
} from '@valtimo/building-block-management';

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
    IconModule,
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

  // What every "copy from" picker may read. `case:` is a case plan's alone and stays offered in both directions — the case is migrating either way.
  public readonly SOURCE_PREFIXES = [ValuePathSelectorPrefix.DOC, ValuePathSelectorPrefix.CASE];

  public readonly compactMode$ = this.pageHeaderService.compactMode$;

  public readonly $model = signal<EditorModel | null>(null);
  public readonly $plan = signal<MigrationPlan>({});
  public readonly $valid = signal<boolean>(false);
  public readonly $saving = signal<boolean>(false);
  // True while the backend composes the pre-filled plan; on a large case definition that is ten seconds of an empty screen.
  public readonly $suggesting = signal<boolean>(false);
  public readonly $isEdit = signal<boolean>(false);
  public readonly $caseDefinitionKey = signal<string | null>(null);
  public readonly $caseDefinitionVersionTag = signal<string | null>(null);
  // The blueprint the plan migrates FROM as the plan declares it — key included, since it may name another case definition.
  public readonly $sourceKey = signal<string | null>(null);
  public readonly $sourceVersionTag = signal<string | null>(null);
  // Memoized so the data-migration value-path selectors get a stable context reference each render.
  public readonly $caseContext = computed(() => ({
    caseDefinitionKey: this.$caseDefinitionKey(),
    caseDefinitionVersionTag: this.$caseDefinitionVersionTag(),
  }));
  // The blueprint this plan targets — the default counterparty of every building-block entry below.
  public readonly $owner = computed<BuildingBlockEntryOwner | null>(() => {
    const key = this.$caseDefinitionKey();
    const versionTag = this.$caseDefinitionVersionTag();
    return key && versionTag ? {type: 'CASE', key, versionTag} : null;
  });
  // Recomputed rather than built once: the params are only known after the route resolves.
  public readonly $api = computed<MigrationEditorApi | null>(() => {
    const key = this.$caseDefinitionKey();
    const versionTag = this.$caseDefinitionVersionTag();
    return key && versionTag
      ? this.caseMigrationApiService.forParams({
          caseDefinitionKey: key,
          caseDefinitionVersionTag: versionTag,
        })
      : null;
  });
  // The "from" side resolves against the source the plan declares — its key as much as its version.
  public readonly $sourceCaseContext = computed(() => ({
    caseDefinitionKey: this.$sourceKey(),
    caseDefinitionVersionTag: this.$sourceVersionTag(),
  }));
  // Extra version tags merged into the "to" list so source-only fields can be cleared. Same key only.
  public readonly $targetAdditionalVersionTags = computed(() => {
    const sourceVersion = this.$sourceVersionTag();
    const sameKey = this.$sourceKey() === this.$caseDefinitionKey();
    return sameKey && sourceVersion && sourceVersion !== this.$caseDefinitionVersionTag()
      ? [sourceVersion]
      : [];
  });
  public readonly $runAfterOptions = signal<SelectItem[]>([]);
  // The other plans' keys, so a generated key cannot collide and overwrite one of them.
  public readonly $usedMigrationKeys = signal<string[]>([]);
  // The case definitions a plan may migrate from, and the versions of whichever one is selected.
  public readonly $sourceKeyOptions = signal<SelectItem[]>([]);
  public readonly $sourceVersionOptions = signal<SelectItem[]>([]);
  // `key -> processDefinitionId` maps scoping the processMigration pickers and driving the activity lookups: source = the declared source version, target = this one.
  public readonly $sourceProcessDefs = signal<Record<string, string>>({});
  public readonly $targetProcessDefs = signal<Record<string, string>>({});
  // The backend requires both `key` and `source.versionTag`, and clearing the source picker is a normal editing step — so Save just stays disabled, without an error.
  public readonly $canSave = computed(() => {
    const plan = this.$plan();
    return (
      this.$valid() &&
      !this.$saving() &&
      !!asPlanText(plan.key) &&
      !!asPlanText(plan.source?.versionTag) &&
      !this.$unmappedProcesses().length &&
      !this.$unmappedEntryProcesses().length
    );
  });
  /** How many `processMigration` sources still name no target. Only the count: a suggested plan leaves several blank and process keys are long, so the instruction card carries the message. */
  public readonly $unmappedProcesses = computed(() =>
    (this.$plan().processMigration ?? [])
      .filter(instruction => !asPlanText(instruction?.targetProcessDefinitionKey))
      .map(instruction => asPlanText(instruction?.sourceProcessDefinitionKey) ?? '?')
  );

  /** The same for the copies nested inside building-block entries, kept separate so each tab warns about its own instructions only. */
  public readonly $unmappedEntryProcesses = computed(() => [
    ...unmappedProcessesIn(this.$plan().addBuildingBlock),
    ...unmappedProcessesIn(this.$plan().removeBuildingBlock),
  ]);

  /** The blank-target sources of every entry's nested `processMigration`, for one component. */
  public readonly $unmappedAddBuildingBlockProcesses = computed(() =>
    unmappedProcessesIn(this.$plan().addBuildingBlock)
  );

  public readonly $unmappedRemoveBuildingBlockProcesses = computed(() =>
    unmappedProcessesIn(this.$plan().removeBuildingBlock)
  );

  private _params!: CaseManagementParams;
  private _migrationKey: string | null = null;
  private _currentValue = '';
  // What the current components were suggested for; guards against re-requesting them, including the echo of the response itself.
  private _suggestedForSource: string | null = null;
  private readonly _subscriptions = new Subscription();

  private readonly NEW_PLAN_TEMPLATE = JSON.stringify(
    {
      title: '',
      key: '',
      source: {key: '', versionTag: ''},
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
    private readonly iconService: IconService,
    private readonly translateService: TranslateService,
    private readonly caseMigrationApiService: CaseMigrationApiService,
    private readonly startableItemApiService: StartableItemApiService,
    private readonly caseManagementService: CaseManagementService
  ) {
    this.iconService.registerAll([WarningFilled16]);
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
    this.loadExistingPlans();
    this.loadProcessKeys();
    this.loadSourceKeyOptions();

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
      // stream() so a cold direct navigation resolves the title instead of showing the raw key.
      this._subscriptions.add(
        this.translateService
          .stream('migrationEditor.createTitle')
          .subscribe(title => this.pageTitleService.setCustomPageTitle(title))
      );
      // Start from a best-effort suggestion, falling back to the empty template.
      this.setValue(this.NEW_PLAN_TEMPLATE);
      this.$suggesting.set(true);
      this.caseMigrationApiService
        .getPlanSuggestion(this._params)
        .pipe(
          take(1),
          finalize(() => this.$suggesting.set(false))
        )
        .subscribe({
          next: suggestion => {
            // Recorded before applying, so the resulting source change does not ask for the same suggestion again.
            this._suggestedForSource = sourceIdOf(
              suggestion['source'] as MigrationPlanSource | undefined,
              this._params.caseDefinitionKey
            );
            this.setValue(JSON.stringify(suggestion, null, 2));
          },
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

    // stream() so the label resolves on a cold direct navigation and follows language changes.
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
    // Sync the tabs with manual JSON edits without touching the editor model, so the cursor is not reset.
    const parsed = parsePlan(value);
    if (parsed) {
      this.$plan.set(parsed);
      this.applySource(parsed.source);
    }
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
    const plan = parsePlan(value) ?? {};
    this.$plan.set(plan);
    this.applySource(plan.source);
  }

  /** Apply a structured change coming from one of the form tabs and reflect it in the JSON editor. */
  private patchPlan(partial: Partial<MigrationPlan>): void {
    const plan: MigrationPlan = {...this.$plan(), ...partial};
    const value = JSON.stringify(plan, null, 2);
    this._currentValue = value;
    this.$plan.set(plan);
    this.$model.set({value, language: 'json'});
    this.applySource(plan.source);
    // A plan built from the form tabs is always structurally valid JSON.
    this.$valid.set(true);
  }

  /** The version's other plans: what `runAfter` may point at, and the keys a new plan must stay clear of. */
  private loadExistingPlans(): void {
    this.caseMigrationApiService
      .getPlans(this._params)
      .pipe(take(1))
      .subscribe(plans => {
        const others = plans.filter(plan => plan.migrationKey !== this._migrationKey);
        this.$runAfterOptions.set(
          others.map(plan => ({id: plan.migrationKey, text: plan.title || plan.migrationKey}))
        );
        this.$usedMigrationKeys.set(others.map(plan => plan.migrationKey));
      });
  }

  /** Scope the process pickers. Only the target half is loaded here — the source half follows the plan and is reloaded by [applySource]. */
  private loadProcessKeys(): void {
    this.linkedProcessDefinitions(
      this._params.caseDefinitionKey,
      this._params.caseDefinitionVersionTag
    )
      .pipe(take(1))
      .subscribe(defs => this.$targetProcessDefs.set(defs));
  }

  /** Follow the plan's declared source and re-scope everything resolving against it. A no-op when it has not changed, so it can be called on every plan change. */
  private applySource(source: MigrationPlanSource | undefined): void {
    const key = asPlanText(source?.key) ?? this._params.caseDefinitionKey;
    const versionTag = asPlanText(source?.versionTag);
    if (key === this.$sourceKey() && versionTag === this.$sourceVersionTag()) return;

    const keyChanged = key !== this.$sourceKey();
    this.$sourceKey.set(key);
    this.$sourceVersionTag.set(versionTag);

    if (keyChanged) this.loadSourceVersionOptions(key);
    if (!versionTag) {
      this.$sourceProcessDefs.set({});
      return;
    }
    this.suggestComponentsFor({key, versionTag});
    this.linkedProcessDefinitions(key, versionTag)
      .pipe(take(1))
      .subscribe({
        next: defs => this.$sourceProcessDefs.set(defs),
        // A source that is not deployed has no processes to offer; the save itself reports the problem.
        error: () => this.$sourceProcessDefs.set({}),
      });
  }

  /** Re-fill the plan's components from a suggestion against [source]. Only while creating — editing leaves them alone, since they are the author's work. */
  private suggestComponentsFor(source: MigrationPlanSource): void {
    const sourceId = sourceIdOf(source, this._params.caseDefinitionKey);
    if (this.$isEdit() || !sourceId || sourceId === this._suggestedForSource) return;

    this._suggestedForSource = sourceId;
    this.$suggesting.set(true);
    this.caseMigrationApiService
      .getPlanSuggestion(this._params, source)
      .pipe(
        take(1),
        finalize(() => this.$suggesting.set(false))
      )
      .subscribe({
        next: suggestion =>
          this.patchPlan({
            dataMigration: (suggestion['dataMigration'] as DataMigrationPatch[]) ?? [],
            processMigration:
              (suggestion['processMigration'] as ProcessMigrationInstruction[]) ?? [],
            addBuildingBlock:
              (suggestion['addBuildingBlock'] as AddBuildingBlockInstruction[]) ?? [],
            removeBuildingBlock:
              (suggestion['removeBuildingBlock'] as RemoveBuildingBlockInstruction[]) ?? [],
          }),
        // Nothing to suggest (an undeployed source, most likely) — leave the plan as the author left it.
        error: () => {},
      });
  }

  /** Every case definition key, so a plan can migrate instances of any of them. */
  private loadSourceKeyOptions(): void {
    this.caseManagementService
      .getCaseDefinitions({size: 500})
      .pipe(take(1))
      .subscribe({
        next: page =>
          this.$sourceKeyOptions.set(
            (page?.content ?? [])
              .map(definition => definition.caseDefinitionKey)
              // One row per case definition *version*, so the same key comes back repeatedly.
              .filter((key, index, keys) => !!key && keys.indexOf(key) === index)
              .map(key => ({id: key, text: key}))
          ),
        error: () => {},
      });
  }

  /** The versions of [key], newest first, for the source version picker. */
  private loadSourceVersionOptions(key: string): void {
    this.caseManagementService
      .getCaseDefinitionVersions(key)
      .pipe(take(1))
      .subscribe({
        next: versions =>
          this.$sourceVersionOptions.set(
            (versions ?? [])
              .map(version => version?.versionTag)
              .filter((versionTag): versionTag is string => !!versionTag)
              .map(versionTag => ({id: versionTag, text: versionTag}))
          ),
        error: () => this.$sourceVersionOptions.set([]),
      });
  }

  /** `processKey -> processDefinitionId` for the processes linked to a case definition version. */
  private linkedProcessDefinitions(
    caseDefinitionKey: string,
    versionTag: string
  ): Observable<Record<string, string>> {
    return this.startableItemApiService
      .getLinkedProcessDefinitions({
        caseDefinitionKey,
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
