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
import {WarningFilled16} from '@carbon/icons';
import {ButtonModule, IconModule, IconService, TabsModule} from 'carbon-components-angular';
import {finalize, map, Observable, Subscription, take} from 'rxjs';
import {
  BUILDING_BLOCK_MANAGEMENT_MIGRATION_TEST_IDS,
  BUILDING_BLOCK_MANAGEMENT_TABS,
} from '../../constants';
import {BuildingBlockManagementApiService, BuildingBlockMigrationApiService} from '../../services';
import {
  AddBuildingBlockInstruction,
  BuildingBlockEntryOwner,
  BuildingBlockMigrationParams,
  DataMigrationPatch,
  MigrationEditorApi,
  MigrationPlan,
  MigrationPlanSource,
  ProcessMigrationInstruction,
  RemoveBuildingBlockInstruction,
} from '../../models';
import {BbMigrationGeneralTabComponent} from './tabs/migration-general-tab.component';
import {MigrationBuildingBlockTabComponent} from '../migration-plan-editor/tabs/migration-building-block-tab.component';
import {MigrationDataMigrationTabComponent} from '../migration-plan-editor/tabs/migration-data-migration-tab.component';
import {MigrationProcessMigrationTabComponent} from '../migration-plan-editor/tabs/migration-process-migration-tab.component';

import {
  asPlanText,
  parsePlan,
  sourceIdOf,
  unmappedProcessesIn,
} from '../migration-plan-editor/migration-plan.utils';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-management-migration-plan-editor',
  templateUrl: './building-block-management-migration-plan-editor.component.html',
  styleUrls: ['./building-block-management-migration-plan-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    EditorModule,
    ButtonModule,
    IconModule,
    TabsModule,
    RenderInPageHeaderDirective,
    BbMigrationGeneralTabComponent,
    MigrationDataMigrationTabComponent,
    MigrationProcessMigrationTabComponent,
    MigrationBuildingBlockTabComponent,
  ],
})
export class BuildingBlockManagementMigrationPlanEditorComponent implements OnInit, OnDestroy {
  protected readonly testIds = BUILDING_BLOCK_MANAGEMENT_MIGRATION_TEST_IDS;

  public readonly compactMode$ = this.pageHeaderService.compactMode$;

  public readonly $model = signal<EditorModel | null>(null);
  public readonly $plan = signal<MigrationPlan>({});
  public readonly $valid = signal<boolean>(false);
  public readonly $saving = signal<boolean>(false);
  // True while the backend is composing the pre-filled plan. That request compares two whole blueprint
  // versions, and on a large building block it takes ten seconds — during which the title, the key and
  // both source pickers are empty and Save is disabled, so the screen is indistinguishable from one that
  // simply does not pre-fill anything. It fills itself; this is what says so.
  public readonly $suggesting = signal<boolean>(false);
  public readonly $isEdit = signal<boolean>(false);
  public readonly $buildingBlockDefinitionKey = signal<string | null>(null);
  public readonly $buildingBlockDefinitionVersionTag = signal<string | null>(null);
  // The blueprint the plan migrates FROM, as the plan itself declares it — key as well as version,
  // since a plan may migrate the instances of an entirely different building block onto this one. Kept
  // in step with the plan's `source` rather than derived from this version's `basedOnVersionTag`.
  public readonly $sourceKey = signal<string | null>(null);
  public readonly $sourceVersionTag = signal<string | null>(null);
  // Memoized so the data-migration value-path selectors get a stable context reference each render.
  public readonly $buildingBlockContext = computed(() => ({
    buildingBlockKey: this.$buildingBlockDefinitionKey(),
    buildingBlockVersionTag: this.$buildingBlockDefinitionVersionTag(),
  }));
  // The blueprint this plan targets, as the shared editor components take it: a building block, which
  // is what makes every entry on the building-block tabs a *nested* one.
  public readonly $owner = computed<BuildingBlockEntryOwner | null>(() => {
    const key = this.$buildingBlockDefinitionKey();
    const versionTag = this.$buildingBlockDefinitionVersionTag();
    return key && versionTag ? {type: 'BUILDING_BLOCK', key, versionTag} : null;
  });
  // The migration API with this building block version bound, for the shared tabs. Recomputed rather
  // than built once because the params are only known after the route resolves.
  public readonly $api = computed<MigrationEditorApi | null>(() => {
    const key = this.$buildingBlockDefinitionKey();
    const versionTag = this.$buildingBlockDefinitionVersionTag();
    return key && versionTag
      ? this.buildingBlockMigrationApiService.forParams({
          buildingBlockDefinitionKey: key,
          buildingBlockDefinitionVersionTag: versionTag,
        })
      : null;
  });
  // The "from" side resolves against the source the plan declares — its key as much as its version.
  public readonly $sourceBuildingBlockContext = computed(() => ({
    buildingBlockKey: this.$sourceKey(),
    buildingBlockVersionTag: this.$sourceVersionTag(),
  }));
  // Extra version tags to merge into the "to" list so source-only fields can be cleared to null. Only
  // meaningful within one key: across keys the two schemas are unrelated lists.
  public readonly $targetAdditionalVersionTags = computed(() => {
    const sourceVersion = this.$sourceVersionTag();
    const sameKey = this.$sourceKey() === this.$buildingBlockDefinitionKey();
    return sameKey && sourceVersion && sourceVersion !== this.$buildingBlockDefinitionVersionTag()
      ? [sourceVersion]
      : [];
  });
  // The keys of this version's other plans, so the key generated from a new plan's title cannot
  // collide with one of them (saving under an existing key would overwrite that plan).
  public readonly $usedMigrationKeys = signal<string[]>([]);
  // The building blocks a plan may migrate from, and the versions of whichever one is selected.
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
      !!asPlanText(plan.key) &&
      !!asPlanText(plan.source?.versionTag) &&
      !this.$unmappedProcesses().length &&
      !this.$unmappedEntryProcesses().length
    );
  });
  /**
   * The `processMigration` sources whose target is still blank. The suggestion deliberately leaves one
   * blank for a process it cannot account for — visible work rather than a silent omission — and the
   * backend refuses to store it, so Save waits until the author has either named a target or removed
   * the row.
   *
   * Only its length is used, to mark the process-migration tab. Naming them here was tried and had to
   * go: a suggested plan leaves several blank at once, and process keys are long, so the line beside
   * Save was an ellipsis with no way to read the rest. The instruction itself carries the message now
   * — its card is flagged in place, which is also where the author has to act.
   */
  public readonly $unmappedProcesses = computed(() =>
    (this.$plan().processMigration ?? [])
      .filter(instruction => !asPlanText(instruction?.targetProcessDefinitionKey))
      .map(instruction => asPlanText(instruction?.sourceProcessDefinitionKey) ?? '?')
  );

  /**
   * The same, for the `processMigration` copies nested inside an `addBuildingBlock` /
   * `removeBuildingBlock` entry. They are edited by the very same component, so they carry the same blank
   * target and the backend refuses them the same way — but they were counted by nothing, so Save stayed
   * enabled and the refusal arrived from the server.
   *
   * Kept separate from [$unmappedProcesses] so each tab's heading warns about its own instructions only.
   */
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

  private _params!: BuildingBlockMigrationParams;
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
    private readonly buildingBlockMigrationApiService: BuildingBlockMigrationApiService,
    private readonly buildingBlockManagementApiService: BuildingBlockManagementApiService
  ) {
    this.iconService.registerAll([WarningFilled16]);
    this.pageTitleService.disableReset();
  }

  public ngOnInit(): void {
    const params = this.route.snapshot.params;
    this._params = {
      buildingBlockDefinitionKey: params['buildingBlockDefinitionKey'],
      buildingBlockDefinitionVersionTag: params['buildingBlockDefinitionVersionTag'],
    };
    this.$buildingBlockDefinitionKey.set(this._params.buildingBlockDefinitionKey);
    this.$buildingBlockDefinitionVersionTag.set(this._params.buildingBlockDefinitionVersionTag);
    this._migrationKey = params['migrationKey'] ?? null;

    this.initBreadcrumbs();
    this.loadExistingPlanKeys();
    this.loadProcessKeys();
    this.loadSourceKeyOptions();

    if (this._migrationKey) {
      this.$isEdit.set(true);
      this.buildingBlockMigrationApiService
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
          .stream('migrationEditor.createTitle')
          .subscribe(title => this.pageTitleService.setCustomPageTitle(title))
      );
      // Start a new plan from a best-effort suggestion (data/process pre-filled),
      // falling back to the empty template if the backend can't produce one.
      this.setValue(this.NEW_PLAN_TEMPLATE);
      this.$suggesting.set(true);
      this.buildingBlockMigrationApiService
        .getPlanSuggestion(this._params)
        .pipe(
          take(1),
          finalize(() => this.$suggesting.set(false))
        )
        .subscribe({
          next: suggestion => {
            // Record what the suggestion was built for before applying it, so the resulting source
            // change does not immediately ask for the same suggestion again.
            this._suggestedForSource = sourceIdOf(
              suggestion['source'] as MigrationPlanSource | undefined,
              this._params.buildingBlockDefinitionKey
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

  /** Restore the building-block-definition + Migration-tab trail that this routed screen is nested under. */
  private initBreadcrumbs(): void {
    const base = `/building-block-management/building-block/${this._params.buildingBlockDefinitionKey}/version/${this._params.buildingBlockDefinitionVersionTag}`;

    // The building-block detail screen requires an explicit tab segment (`.../version/:versionTag/:tabKey`),
    // so the building-block breadcrumb must target a concrete tab — landing on the general tab — rather
    // than the bare version URL, which matches no route and falls through to the dashboard.
    const detailRoute = `${base}/${BUILDING_BLOCK_MANAGEMENT_TABS.GENERAL}`;

    this.breadcrumbService.setThirdBreadcrumb({
      route: [detailRoute],
      content: `${this._params.buildingBlockDefinitionKey} (${this._params.buildingBlockDefinitionVersionTag})`,
      href: detailRoute,
    });

    const migrationRoute = `${base}/${BUILDING_BLOCK_MANAGEMENT_TABS.MIGRATION}`;

    // stream() so the label resolves even on a cold direct navigation (and follows language changes)
    // instead of freezing the raw translation key.
    this._subscriptions.add(
      this.translateService.stream('buildingBlockManagement.tabs.migration').subscribe(content =>
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
    this.buildingBlockMigrationApiService.savePlan(this._params, parsed).subscribe({
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

  /**
   * The keys of this version's other migration plans, which is what the key generated from a new plan's
   * title has to stay clear of — a save under an existing key overwrites that plan.
   */
  private loadExistingPlanKeys(): void {
    this.buildingBlockMigrationApiService
      .getPlans(this._params)
      .pipe(take(1))
      .subscribe(plans =>
        this.$usedMigrationKeys.set(
          plans
            .filter(plan => plan.migrationKey !== this._migrationKey)
            .map(plan => plan.migrationKey)
        )
      );
  }

  /**
   * Scope the process pickers: the TARGET picker lists the processes linked to this (the plan's own)
   * building block definition version. The SOURCE half follows whatever the plan declares as its
   * source, so it is (re)loaded by [applySource] rather than here.
   */
  private loadProcessKeys(): void {
    this.linkedProcessDefinitions(
      this._params.buildingBlockDefinitionKey,
      this._params.buildingBlockDefinitionVersionTag
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
    const key = asPlanText(source?.key) ?? this._params.buildingBlockDefinitionKey;
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

  /**
   * Re-fill the plan's components (`dataMigration`, `processMigration`, the building block
   * instructions) from a suggestion against [source], because a suggestion is a comparison of source
   * with target and says nothing useful once the source has changed. This matters most here: a source
   * under a *different* building block key makes the previous suggestion describe two blueprints that
   * no longer feature in the plan at all.
   *
   * Only while **creating** a plan. Editing an existing one leaves the components alone: they are the
   * author's work, and silently replacing them because the source was adjusted would throw it away.
   * The author's own fields (title, key) survive either way — only the component sections are
   * replaced, and a component the new suggestion has nothing to say about is emptied rather than left
   * describing the previous source.
   */
  private suggestComponentsFor(source: MigrationPlanSource): void {
    const sourceId = sourceIdOf(source, this._params.buildingBlockDefinitionKey);
    if (this.$isEdit() || !sourceId || sourceId === this._suggestedForSource) return;

    this._suggestedForSource = sourceId;
    this.$suggesting.set(true);
    this.buildingBlockMigrationApiService
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

  /** Every building block key, so a plan can migrate the instances of any of them onto this one. */
  private loadSourceKeyOptions(): void {
    this.buildingBlockManagementApiService
      .getBuildingBlockDefinitions()
      .pipe(take(1))
      .subscribe({
        next: definitions =>
          this.$sourceKeyOptions.set(
            (definitions ?? [])
              .map(definition => definition.key)
              .filter((key): key is string => !!key)
              .filter((key, index, keys) => keys.indexOf(key) === index)
              .map(key => ({id: key, text: key}))
          ),
        error: () => {},
      });
  }

  /** The versions of [key], for the source version picker. */
  private loadSourceVersionOptions(key: string): void {
    this.buildingBlockManagementApiService
      .getVersionsForBuildingBlock(key, 0, 100, true)
      .pipe(take(1))
      .subscribe({
        next: page =>
          this.$sourceVersionOptions.set(
            (page?.content ?? [])
              .map(version => version?.versionTag)
              .filter((versionTag): versionTag is string => !!versionTag)
              .map(versionTag => ({id: versionTag, text: versionTag}))
          ),
        error: () => this.$sourceVersionOptions.set([]),
      });
  }

  /** `processKey -> processDefinitionId` for the processes linked to a building block definition version. */
  private linkedProcessDefinitions(
    key: string,
    versionTag: string
  ): Observable<Record<string, string>> {
    return this.buildingBlockManagementApiService
      .getBuildingBlockProcessDefinitions(key, versionTag)
      .pipe(
        map(definitions => {
          const defs: Record<string, string> = {};
          definitions.forEach(definition => {
            if (definition?.key && definition?.id) defs[definition.key] = definition.id;
          });
          return defs;
        })
      );
  }

  private navigateBack(): void {
    this.router.navigateByUrl(
      `building-block-management/building-block/${this._params.buildingBlockDefinitionKey}/version/${this._params.buildingBlockDefinitionVersionTag}/${BUILDING_BLOCK_MANAGEMENT_TABS.MIGRATION}`
    );
  }
}
