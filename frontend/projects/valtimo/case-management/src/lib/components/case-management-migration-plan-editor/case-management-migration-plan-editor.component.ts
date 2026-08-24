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
import {finalize, map, Observable, Subscription, take} from 'rxjs';
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
  MigrationPlanSource,
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
  // True while the backend is composing the pre-filled plan. That request compares two whole blueprint
  // versions, and on a large case definition it takes ten seconds — during which the title, the key and
  // both source pickers are empty and Save is disabled, so the screen is indistinguishable from one that
  // simply does not pre-fill anything. It fills itself; this is what says so.
  public readonly $suggesting = signal<boolean>(false);
  public readonly $isEdit = signal<boolean>(false);
  public readonly $caseDefinitionKey = signal<string | null>(null);
  public readonly $caseDefinitionVersionTag = signal<string | null>(null);
  // The blueprint the plan migrates FROM, as the plan itself declares it — key as well as version,
  // since a plan may migrate instances of a differently-named case definition. Kept in step with the
  // plan's `source` rather than derived from this version's `basedOnVersionTag`.
  public readonly $sourceKey = signal<string | null>(null);
  public readonly $sourceVersionTag = signal<string | null>(null);
  // Memoized so the data-migration value-path selectors get a stable context reference each render.
  public readonly $caseContext = computed(() => ({
    caseDefinitionKey: this.$caseDefinitionKey(),
    caseDefinitionVersionTag: this.$caseDefinitionVersionTag(),
  }));
  // The "from" side resolves against the source the plan declares — its key as much as its version.
  public readonly $sourceCaseContext = computed(() => ({
    caseDefinitionKey: this.$sourceKey(),
    caseDefinitionVersionTag: this.$sourceVersionTag(),
  }));
  // Extra version tags to merge into the "to" list so source-only fields can be cleared to null. Only
  // meaningful within one key: across keys the two schemas are unrelated lists.
  public readonly $targetAdditionalVersionTags = computed(() => {
    const sourceVersion = this.$sourceVersionTag();
    const sameKey = this.$sourceKey() === this.$caseDefinitionKey();
    return sameKey && sourceVersion && sourceVersion !== this.$caseDefinitionVersionTag()
      ? [sourceVersion]
      : [];
  });
  public readonly $runAfterOptions = signal<SelectItem[]>([]);
  // The keys of this version's other plans, so the key generated from a new plan's title cannot
  // collide with one of them (saving under an existing key would overwrite that plan).
  public readonly $usedMigrationKeys = signal<string[]>([]);
  // The case definitions a plan may migrate from, and the versions of whichever one is selected.
  public readonly $sourceKeyOptions = signal<SelectItem[]>([]);
  public readonly $sourceVersionOptions = signal<SelectItem[]>([]);
  // `key -> processDefinitionId` maps that scope the processMigration pickers AND drive the activity
  // lookups. A plan migrates FROM the source it declares TO the version it is deployed under, so the
  // source map holds the declared source version's linked processes and the target map holds this
  // one's.
  public readonly $sourceProcessDefs = signal<Record<string, string>>({});
  public readonly $targetProcessDefs = signal<Record<string, string>>({});
  // The plan's `key` identifies it and its `source.versionTag` says which version it migrates FROM.
  // The backend requires both, so a save missing either fails; Save therefore stays disabled until the
  // JSON is valid, not already saving, and both are present. Clearing the source version picker is a
  // normal editing step, so it has to leave the screen quiet — no error, just no way to save yet.
  public readonly $canSave = computed(() => {
    const plan = this.$plan();
    return (
      this.$valid() &&
      !this.$saving() &&
      !!this.asText(plan.key) &&
      !!this.asText(plan.source?.versionTag) &&
      !this.$unmappedProcesses().length
    );
  });
  /**
   * The `processMigration` sources whose target is still blank. The suggestion deliberately leaves one
   * blank for a process it cannot account for — visible work rather than a silent omission — and the
   * backend refuses to store it, so Save waits until the author has either named a target or removed
   * the row. Listed rather than counted, because "which ones" is what turns a disabled button into
   * something the author can act on.
   */
  public readonly $unmappedProcesses = computed(() =>
    (this.$plan().processMigration ?? [])
      .filter(instruction => !this.asText(instruction?.targetProcessDefinitionKey))
      .map(instruction => this.asText(instruction?.sourceProcessDefinitionKey) ?? '?')
  );

  private _params!: CaseManagementParams;
  private _migrationKey: string | null = null;
  private _currentValue = '';
  // The source the components currently in the plan were suggested for, as `<key>:<versionTag>`.
  // Guards [suggestComponentsFor] against re-requesting what is already there — in particular the
  // echo of its own response, which comes back through [applySource] like any other plan change.
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
      this.$suggesting.set(true);
      this.caseMigrationApiService
        .getPlanSuggestion(this._params)
        .pipe(
          take(1),
          finalize(() => this.$suggesting.set(false))
        )
        .subscribe({
          next: suggestion => {
            // Record what the suggestion was built for before applying it, so the resulting source
            // change does not immediately ask for the same suggestion again.
            this._suggestedForSource = this.sourceIdOf(
              suggestion['source'] as MigrationPlanSource | undefined
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
    const plan = this.parse(value) ?? {};
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

  private parse(value: string): MigrationPlan | null {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null ? (parsed as MigrationPlan) : null;
    } catch {
      return null;
    }
  }

  /**
   * Load the other migration plans of this case definition version: they are what `runAfter` may point
   * at, and their keys are the ones a new plan's generated key has to stay clear of.
   */
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

  /**
   * Scope the process pickers: the TARGET picker lists the processes linked to this (the plan's own)
   * case definition version; the SOURCE picker lists those linked to whatever the plan declares as its
   * source — a different version, and possibly a different case definition key altogether.
   *
   * Only the target half is loaded here. The source half follows the plan, so it is (re)loaded by
   * [applySource] whenever the plan's `source` changes.
   */
  private loadProcessKeys(): void {
    this.linkedProcessDefinitions(
      this._params.caseDefinitionKey,
      this._params.caseDefinitionVersionTag
    )
      .pipe(take(1))
      .subscribe(defs => this.$targetProcessDefs.set(defs));
  }

  /**
   * Follow the plan's declared source: remember it, list the versions of its key for the picker, and
   * re-scope everything that resolves against the source (the value-path selectors and the
   * processMigration source picker). A no-op when the source has not actually changed, so it can be
   * called on every plan change.
   */
  private applySource(source: MigrationPlanSource | undefined): void {
    const key = this.asText(source?.key) ?? this._params.caseDefinitionKey;
    const versionTag = this.asText(source?.versionTag);
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

  /**
   * Re-fill the plan's components (`dataMigration`, `processMigration`, the building block
   * instructions) from a suggestion against [source], because a suggestion is a comparison of source
   * with target and says nothing useful once the source has changed.
   *
   * Only while **creating** a plan. Editing an existing one leaves the components alone: they are the
   * author's work, and silently replacing them because the source was adjusted would throw it away.
   * The author's own fields (title, key, triggers, conditions) survive either way — only the component
   * sections are replaced, and a component the new suggestion has nothing to say about is emptied
   * rather than left describing the previous source.
   */
  private suggestComponentsFor(source: MigrationPlanSource): void {
    const sourceId = this.sourceIdOf(source);
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

  /** A source as a comparable `<key>:<versionTag>`, or null when it is not complete enough to use. */
  private sourceIdOf(source: MigrationPlanSource | undefined): string | null {
    const key = this.asText(source?.key) ?? this._params.caseDefinitionKey;
    const versionTag = this.asText(source?.versionTag);
    return versionTag ? `${key}:${versionTag}` : null;
  }

  /**
   * [value] when it is a non-blank string, else null — the only two shapes a key or a version tag may
   * take. The plan is `JSON.parse`d from a free-form editor and patched by pickers, so a field can
   * arrive as something else entirely (Carbon's combobox clears a selection to `[]`); an
   * empty-but-truthy value would otherwise pass a `||` guard and end up interpolated into a request
   * URL as an empty path segment.
   */
  private asText(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
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
