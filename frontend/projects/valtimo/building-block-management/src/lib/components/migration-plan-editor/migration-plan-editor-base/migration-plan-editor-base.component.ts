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

import {HttpErrorResponse} from '@angular/common/http';
import {computed, Directive, inject, OnDestroy, OnInit, Signal, signal} from '@angular/core';
import {ActivatedRoute, Params} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {
  EditorModel,
  PageHeaderService,
  PageTitleService,
  SelectItem,
  ValuePathSelectorPrefix,
} from '@valtimo/components';
import {getServerErrorMessage} from '@valtimo/shared';
import {finalize, Observable, Subscription, take} from 'rxjs';
import {
  AddBuildingBlockInstruction,
  BuildingBlockEntryOwner,
  BuildingBlockEntryOwnerType,
  DataMigrationPatch,
  MigrationEditorApi,
  MigrationEditorTestIds,
  MigrationEditorTranslationKeys,
  MigrationPlan,
  MigrationPlanManagement,
  MigrationPlanSource,
  MigrationPlanSummary,
  ProcessMigrationInstruction,
  RemoveBuildingBlockInstruction,
  ValuePathContext,
} from '../../../models';
import {BlueprintMigrationApiService} from '../../../services/blueprint-migration-api.service';
import {
  asPlanText,
  migrationEditorKeys,
  parsePlan,
  sourceIdOf,
  unmappedProcessesIn,
} from '../../../utils';

/** Blueprint-agnostic editor half — holds the plan, keeps JSON and form tabs in step, follows the declared source, saves. Subclass supplies blueprint identity. */
@Directive()
export abstract class MigrationPlanEditorBaseComponent<
    P,
    M extends MigrationPlanSummary = MigrationPlanManagement,
  >
  implements OnInit, OnDestroy
{
  protected readonly route = inject(ActivatedRoute);
  protected readonly translateService = inject(TranslateService);
  protected readonly pageHeaderService = inject(PageHeaderService);
  protected readonly pageTitleService = inject(PageTitleService);

  public readonly compactMode$ = this.pageHeaderService.compactMode$;

  public readonly $model = signal<EditorModel | null>(null);
  public readonly $plan = signal<MigrationPlan>({});
  public readonly $valid = signal<boolean>(false);
  public readonly $saving = signal<boolean>(false);
  /** The server's refusal, kept on screen until the next save. */
  public readonly $saveError = signal<string | null>(null);
  // True while the backend composes the pre-filled plan; on a large blueprint that is ten seconds of an empty screen.
  public readonly $suggesting = signal<boolean>(false);
  public readonly $isEdit = signal<boolean>(false);

  /** The blueprint this plan is deployed under — the "to" side. */
  public readonly $targetKey = signal<string | null>(null);
  public readonly $targetVersionTag = signal<string | null>(null);

  // The blueprint the plan migrates FROM as the plan declares it — key included, since it may name another blueprint.
  public readonly $sourceKey = signal<string | null>(null);
  public readonly $sourceVersionTag = signal<string | null>(null);

  // The other plans' keys, so a generated key cannot collide and overwrite one of them.
  public readonly $usedMigrationKeys = signal<string[]>([]);
  // The blueprints a plan may migrate from, and the versions of whichever one is selected.
  public readonly $sourceKeyOptions = signal<SelectItem[]>([]);
  public readonly $sourceVersionOptions = signal<SelectItem[]>([]);
  // `key -> processDefinitionId` maps scoping the processMigration pickers and driving the activity lookups: source = the declared source version, target = this one.
  public readonly $sourceProcessDefs = signal<Record<string, string>>({});
  public readonly $targetProcessDefs = signal<Record<string, string>>({});

  // The blueprint this plan targets — the default counterparty of every building-block entry below.
  public readonly $owner = computed<BuildingBlockEntryOwner | null>(() => {
    const key = this.$targetKey();
    const versionTag = this.$targetVersionTag();
    return key && versionTag ? {type: this.ownerType, key, versionTag} : null;
  });

  // Recomputed rather than built once: the params are only known after the route resolves.
  public readonly $api = computed<MigrationEditorApi | null>(() =>
    this.$targetKey() && this.$targetVersionTag()
      ? this.migrationApiService.forParams(this._params)
      : null
  );

  // Extra version tags merged into the "to" list so source-only fields can be cleared. Same key only.
  public readonly $targetAdditionalVersionTags = computed(() => {
    const sourceVersion = this.$sourceVersionTag();
    const sameKey = this.$sourceKey() === this.$targetKey();
    return sameKey && sourceVersion && sourceVersion !== this.$targetVersionTag()
      ? [sourceVersion]
      : [];
  });

  /** How many `processMigration` sources still name no target. Only the count: a suggested plan leaves several blank and process keys are long, so the instruction card carries the message. */
  public readonly $unmappedProcesses = computed(() =>
    (this.$plan().processMigration ?? [])
      .filter(instruction => !asPlanText(instruction?.targetProcessDefinitionKey))
      .map(instruction => asPlanText(instruction?.sourceProcessDefinitionKey) ?? '?')
  );

  /** The blank-target sources of every entry's nested `processMigration`, kept separate so each tab warns about its own instructions only. */
  public readonly $unmappedAddBuildingBlockProcesses = computed(() =>
    unmappedProcessesIn(this.$plan().addBuildingBlock)
  );

  public readonly $unmappedRemoveBuildingBlockProcesses = computed(() =>
    unmappedProcessesIn(this.$plan().removeBuildingBlock)
  );

  // The backend requires both `key` and `source.versionTag`, and clearing the source picker is a normal editing step — so Save just stays disabled, without an error.
  public readonly $canSave = computed(() => {
    const plan = this.$plan();
    return (
      this.$valid() &&
      !this.$saving() &&
      !!asPlanText(plan.key) &&
      !!asPlanText(plan.source?.versionTag) &&
      !this.$unmappedProcesses().length &&
      !this.$unmappedAddBuildingBlockProcesses().length &&
      !this.$unmappedRemoveBuildingBlockProcesses().length
    );
  });

  /** What every "copy from" picker may read. A case plan widens this — `case:` metadata is its alone. */
  public readonly sourcePrefixes: ValuePathSelectorPrefix[] = [ValuePathSelectorPrefix.DOC];

  public abstract readonly testIds: MigrationEditorTestIds;
  /** The value-path contexts each side of the plan resolves against — the one place the two blueprint types name a blueprint differently. */
  public abstract readonly $sourceContext: Signal<ValuePathContext>;
  public abstract readonly $targetContext: Signal<ValuePathContext>;

  protected _params!: P;
  protected _migrationKey: string | null = null;
  protected readonly _subscriptions = new Subscription();

  /** Which blueprint type this editor serves — the namespace its translations live under, and the `type` of every building-block entry's owner. */
  protected abstract readonly translationPrefix: string;
  protected abstract readonly ownerType: BuildingBlockEntryOwnerType;
  protected abstract readonly NEW_PLAN_TEMPLATE: string;
  protected abstract readonly migrationApiService: BlueprintMigrationApiService<P, M>;

  private _currentValue = '';
  // What the current components were suggested for; guards against re-requesting them, including the echo of the response itself.
  private _suggestedForSource: string | null = null;
  private _keys: MigrationEditorTranslationKeys | null = null;

  /** Cached, so the shell's inputs keep a stable reference under OnPush. */
  public get keys(): MigrationEditorTranslationKeys {
    return (this._keys ??= migrationEditorKeys(this.translationPrefix));
  }

  public ngOnInit(): void {
    // The plan's own title replaces the route's, so the shared reset must not undo it — paired with [enableReset] in ngOnDestroy.
    this.pageTitleService.disableReset();

    const params = this.route.snapshot.params;
    this._params = this.readParams(params);
    this.$targetKey.set(this.targetKeyOf(this._params));
    this.$targetVersionTag.set(this.targetVersionTagOf(this._params));
    this._migrationKey = params['migrationKey'] ?? null;

    this.initBreadcrumbs();
    this.loadExistingPlans();
    this.loadProcessKeys();
    this.loadSourceKeyOptions();

    if (this._migrationKey) {
      this.$isEdit.set(true);
      this.migrationApiService
        .getPlanJson(this._params, this._migrationKey)
        .pipe(take(1))
        .subscribe(json => {
          this.setValue(JSON.stringify(json, null, 2));
          const title = typeof json['title'] === 'string' ? (json['title'] as string) : null;
          this.pageTitleService.setCustomPageTitle(title || this._migrationKey!);
        });
      return;
    }

    // stream() so a cold direct navigation resolves the title instead of showing the raw key.
    this._subscriptions.add(
      this.translateService
        .stream('migrationEditor.createTitle')
        .subscribe(title => this.pageTitleService.setCustomPageTitle(title))
    );
    // Start from a best-effort suggestion, falling back to the empty template.
    this.setValue(this.NEW_PLAN_TEMPLATE);
    this.$suggesting.set(true);
    this.migrationApiService
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
            this.$targetKey()!
          );
          this.setValue(JSON.stringify(suggestion, null, 2));
        },
        error: () => {},
      });
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this.pageTitleService.enableReset();
    this.clearBreadcrumbs();
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
    this.$saveError.set(null);
    this.migrationApiService.savePlan(this._params, parsed, true).subscribe({
      next: () => this.navigateBack(),
      error: (error: HttpErrorResponse) => {
        this.$saving.set(false);
        // Only the 400 the request suppressed the toast for; anything else is the global handler's.
        if (error?.status !== 400) return;
        this.$saveError.set(
          getServerErrorMessage(error) ??
            this.translateService.instant(this.keys.saveFailedFallback)
        );
      },
    });
  }

  public onCancel(): void {
    this.navigateBack();
  }

  protected setValue(value: string): void {
    this._currentValue = value;
    this.$model.set({value, language: 'json'});
    const plan = parsePlan(value) ?? {};
    this.$plan.set(plan);
    this.applySource(plan.source);
  }

  protected patchPlan(partial: Partial<MigrationPlan>): void {
    const plan: MigrationPlan = {...this.$plan(), ...partial};
    const value = JSON.stringify(plan, null, 2);
    this._currentValue = value;
    this.$plan.set(plan);
    this.$model.set({value, language: 'json'});
    this.applySource(plan.source);
    // A plan built from the form tabs is always structurally valid JSON.
    this.$valid.set(true);
  }

  /** Follow the plan's declared source and re-scope everything resolving against it. A no-op when it has not changed, so it can be called on every plan change. */
  protected applySource(source: MigrationPlanSource | undefined): void {
    const key = asPlanText(source?.key) ?? this.$targetKey()!;
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

  /** What identifies this editor's blueprint, read off the route. */
  protected abstract readParams(params: Params): P;
  protected abstract targetKeyOf(params: P): string;
  protected abstract targetVersionTagOf(params: P): string;

  /** The blueprints a plan may migrate from, and the versions of whichever one is selected. */
  protected abstract loadSourceKeyOptions(): void;
  protected abstract loadSourceVersionOptions(key: string): void;

  /** The `key -> processDefinitionId` map of one blueprint version — how the two types link a process differs. */
  protected abstract linkedProcessDefinitions(
    key: string,
    versionTag: string
  ): Observable<Record<string, string>>;

  protected abstract initBreadcrumbs(): void;
  protected abstract clearBreadcrumbs(): void;
  protected abstract navigateBack(): void;

  /** What else this blueprint type does with the version's other plans. Nothing, unless a subclass says otherwise. */
  protected onPlansLoaded(_others: M[]): void {}

  /** The version's other plans: the keys a new plan must stay clear of, plus whatever else a blueprint type does with them — see [onPlansLoaded]. */
  private loadExistingPlans(): void {
    this.migrationApiService
      .getPlans(this._params)
      .pipe(take(1))
      .subscribe(plans => {
        const others = plans.filter(plan => plan.migrationKey !== this._migrationKey);
        this.$usedMigrationKeys.set(others.map(plan => plan.migrationKey));
        this.onPlansLoaded(others);
      });
  }

  /** Scope the process pickers. Only the target half is loaded here — the source half follows the plan and is reloaded by [applySource]. */
  private loadProcessKeys(): void {
    this.linkedProcessDefinitions(this.$targetKey()!, this.$targetVersionTag()!)
      .pipe(take(1))
      .subscribe(defs => this.$targetProcessDefs.set(defs));
  }

  /** Re-fill the plan's components from a suggestion against [source] — most of all across keys, where the old suggestion describes two blueprints the plan no longer mentions. Only while creating: editing leaves them alone, since they are the author's work. */
  private suggestComponentsFor(source: MigrationPlanSource): void {
    const sourceId = sourceIdOf(source, this.$targetKey()!);
    if (this.$isEdit() || !sourceId || sourceId === this._suggestedForSource) return;

    this._suggestedForSource = sourceId;
    this.$suggesting.set(true);
    this.migrationApiService
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
}
