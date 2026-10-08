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

import {computed, Injectable, OnDestroy, signal} from '@angular/core';
import {FormBuilder, FormGroup} from '@angular/forms';
import {runAfterCarbonModalClosed} from '@valtimo/components';
import {PluginConfiguration, PluginManagementService} from '@valtimo/plugin';
import {
  BuildingBlockDefinitionDto,
  BuildingBlockVersionDto,
  BuildingBlockReferenceUpdateChainDto,
  BuildingBlockReferenceUpdateChainResolutionDto,
  BuildingBlockReferenceUpdateExecuteRequestDto,
  BuildingBlockReferenceUpdatePreviewDto,
  BuildingBlockReferenceUpdatePreviewRequestDto,
  BuildingBlockReferenceUpdateResultDto,
} from '@valtimo/shared';
import {ListItem} from 'carbon-components-angular';
import {catchError, debounceTime, of, Subject, Subscription, switchMap, tap} from 'rxjs';
import {
  REFERENCE_UPDATE_PREVIEW_DEBOUNCE_MS,
  REFERENCE_UPDATE_STEP,
  REFERENCE_UPDATE_STEPS,
} from '../../constants';
import {
  ReferenceUpdateInputFormValue,
  ReferenceUpdateInputMode,
  ReferenceUpdateResolutionFormValue,
  ReferenceUpdateSource,
} from '../../models';
import {
  BuildingBlockManagementApiService,
  BuildingBlockManagementDetailService,
  BuildingBlockReferenceUpdateApiService,
} from '../../services';

/** Reference update wizard state, shared by the modal and its steps. */
@Injectable()
export class BuildingBlockReferenceUpdateWizardService implements OnDestroy {
  public readonly resolutionForm: FormGroup = this.fb.group({});

  public readonly $step = signal<REFERENCE_UPDATE_STEP>(REFERENCE_UPDATE_STEPS[0]);
  public readonly $source = signal<ReferenceUpdateSource | null>(null);
  public readonly $targetDefinitions = signal<BuildingBlockDefinitionDto[] | null>(null);
  public readonly $targetKey = signal<string | null>(null);
  public readonly $targetVersions = signal<BuildingBlockVersionDto[] | null>(null);
  public readonly $target = signal<string | null>(null);
  public readonly $preview = signal<BuildingBlockReferenceUpdatePreviewDto | null>(null);
  public readonly $previewLoading = signal<boolean>(false);
  public readonly $previewFailed = signal<boolean>(false);
  public readonly $selectedChainIds = signal<string[]>([]);
  public readonly $pluginConfigurations = signal<Record<string, PluginConfiguration[]>>({});
  public readonly $confirmed = signal<boolean>(false);
  public readonly $executing = signal<boolean>(false);
  public readonly $result = signal<BuildingBlockReferenceUpdateResultDto | null>(null);

  public readonly $currentStepIndex = computed(() => REFERENCE_UPDATE_STEPS.indexOf(this.$step()));

  public readonly $selectedChains = computed((): BuildingBlockReferenceUpdateChainDto[] => {
    const selectedIds = this.$selectedChainIds();
    return (this.$preview()?.chains ?? []).filter(chain => selectedIds.includes(chain.id));
  });

  public readonly $canProceed = computed((): boolean => {
    switch (this.$step()) {
      case REFERENCE_UPDATE_STEP.TARGET:
        return this.$target() !== null && !this.isSourceVersion(this.$targetKey(), this.$target());
      case REFERENCE_UPDATE_STEP.CHAINS:
        return this.selectedChainsUpdatable();
      case REFERENCE_UPDATE_STEP.DIFFERENCES:
        return this.selectedChainsConfigured();
      case REFERENCE_UPDATE_STEP.REVIEW:
        return this.selectedChainsConfigured() && this.$confirmed() && !this.$executing();
      default:
        return false;
    }
  });

  private _selectionInitialized = false;

  private readonly _previewRequests$ = new Subject<BuildingBlockReferenceUpdatePreviewRequestDto>();
  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly buildingBlockManagementApiService: BuildingBlockManagementApiService,
    private readonly buildingBlockManagementDetailService: BuildingBlockManagementDetailService,
    private readonly buildingBlockReferenceUpdateApiService: BuildingBlockReferenceUpdateApiService,
    private readonly fb: FormBuilder,
    private readonly pluginManagementService: PluginManagementService
  ) {
    this._subscriptions.add(
      this._previewRequests$
        .pipe(
          switchMap(request =>
            this.buildingBlockReferenceUpdateApiService
              .preview(request)
              .pipe(catchError(() => of(null)))
          )
        )
        .subscribe(preview => this.onPreviewLoaded(preview))
    );

    this._subscriptions.add(
      this.resolutionForm.valueChanges
        .pipe(
          tap(() => this.$previewLoading.set(true)),
          debounceTime(REFERENCE_UPDATE_PREVIEW_DEBOUNCE_MS)
        )
        .subscribe(() => this.requestPreview())
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public start(source: ReferenceUpdateSource): void {
    this.setSource(source);
    this.loadTargetDefinitions();
  }

  public close(): void {
    if (this.$executing()) return;

    this.buildingBlockManagementDetailService.hideReferenceUpdateModal();
    runAfterCarbonModalClosed(() => this.reset());
  }

  public back(): void {
    const previousStep = REFERENCE_UPDATE_STEPS[this.$currentStepIndex() - 1];
    if (!previousStep || this.$result() !== null) return;

    this.$confirmed.set(false);
    this.$step.set(previousStep);
  }

  public next(): void {
    const nextStep = REFERENCE_UPDATE_STEPS[this.$currentStepIndex() + 1];
    if (!nextStep || !this.$canProceed()) return;

    this.$step.set(nextStep);

    switch (nextStep) {
      case REFERENCE_UPDATE_STEP.CHAINS:
        if (this.$preview() === null) this.requestPreview();
        break;
      case REFERENCE_UPDATE_STEP.DIFFERENCES:
        this.syncResolutionForm();
        this.loadPluginConfigurations();
        this.requestPreview();
        break;
      case REFERENCE_UPDATE_STEP.REVIEW:
        this.$confirmed.set(false);
        break;
    }
  }

  public selectTargetKey(event: ListItem | ListItem[] | null): void {
    const targetKey = this.selectedItemId(event);
    if (targetKey === this.$targetKey()) return;

    this.setTargetKey(targetKey);
  }

  public selectTarget(event: ListItem | ListItem[] | null): void {
    const target = this.selectedItemId(event);
    if (target === this.$target()) return;

    this.$target.set(target);
    this.resetChains();
  }

  public setChainSelected(chainId: string, checked: boolean): void {
    const selected = this.$selectedChainIds().filter(id => id !== chainId);
    this.$selectedChainIds.set(checked ? [...selected, chainId] : selected);
    this.requestPreview();
  }

  public setConfirmed(confirmed: boolean): void {
    this.$confirmed.set(confirmed);
  }

  public execute(): void {
    if (this.$step() !== REFERENCE_UPDATE_STEP.REVIEW || !this.$canProceed()) return;

    this.$executing.set(true);
    this.buildingBlockReferenceUpdateApiService.execute(this.buildExecuteRequest()).subscribe({
      next: result => {
        this.$executing.set(false);
        this.$result.set(result);
        this.buildingBlockManagementDetailService.reloadReferences();
      },
      error: () => this.$executing.set(false),
    });
  }

  public requestPreview(): void {
    const source = this.$source();
    const targetKey = this.$targetKey();
    const target = this.$target();
    if (!source || !targetKey || !target) return;

    this.$previewLoading.set(true);
    this._previewRequests$.next({
      key: source.key,
      sourceVersionTag: source.versionTag,
      targetKey,
      targetVersionTag: target,
      selectedChainIds: this._selectionInitialized ? [...this.$selectedChainIds()] : null,
      resolutions: this.buildResolutions(),
    });
  }

  public isSourceVersion(key: string | null, versionTag: string | null): boolean {
    const source = this.$source();
    return !!source && source.key === key && source.versionTag === versionTag;
  }

  private buildExecuteRequest(): BuildingBlockReferenceUpdateExecuteRequestDto {
    return {
      key: this.$source()?.key ?? '',
      sourceVersionTag: this.$source()?.versionTag ?? '',
      targetKey: this.$targetKey(),
      targetVersionTag: this.$target() ?? '',
      selectedChainIds: [...this.$selectedChainIds()],
      resolutions: this.buildResolutions(),
    };
  }

  private setSource(source: ReferenceUpdateSource): void {
    this.$source.set(source);
    this.setTargetKey(source.key);
  }

  private setTargetKey(targetKey: string | null): void {
    this.$targetKey.set(targetKey);
    this.$target.set(null);
    this.$targetVersions.set(null);
    this.resetChains();
    if (!targetKey) return;

    this.buildingBlockManagementApiService
      .getVersionsForBuildingBlock(targetKey, 0, 5, true)
      .subscribe({
        next: versions => {
          if (targetKey === this.$targetKey()) this.$targetVersions.set(versions.content);
        },
        error: () => {
          if (targetKey === this.$targetKey()) this.$targetVersions.set([]);
        },
      });
  }

  private selectedItemId(event: ListItem | ListItem[] | null): string | null {
    const item = Array.isArray(event) ? event[0] : event;
    return item?.selected ? (item['id'] ?? null) : null;
  }

  private loadTargetDefinitions(): void {
    this.$targetDefinitions.set(null);
    this.buildingBlockManagementApiService.getBuildingBlockDefinitions().subscribe({
      next: definitions => this.$targetDefinitions.set(definitions),
      error: () => this.$targetDefinitions.set([]),
    });
  }

  private onPreviewLoaded(preview: BuildingBlockReferenceUpdatePreviewDto | null): void {
    this.$previewLoading.set(false);
    this.$previewFailed.set(preview === null);
    if (!preview || !this.previewMatchesSelection(preview)) return;

    this.$preview.set(preview);
    if (this._selectionInitialized) return;

    this._selectionInitialized = true;
    const defaults = preview.chains
      .filter(chain => chain.selectedByDefault && chain.updatable)
      .map(chain => chain.id);
    const selectedByServer = preview.chains.filter(chain => chain.selected).map(chain => chain.id);
    this.$selectedChainIds.set(defaults);

    if (!this.sameIds(defaults, selectedByServer)) this.requestPreview();
  }

  private previewMatchesSelection(preview: BuildingBlockReferenceUpdatePreviewDto): boolean {
    return (
      preview.key === this.$source()?.key &&
      preview.sourceVersionTag === this.$source()?.versionTag &&
      preview.targetKey === this.$targetKey() &&
      preview.targetVersionTag === this.$target()
    );
  }

  private selectedChainsUpdatable(): boolean {
    const preview = this.$preview();
    const selectedChains = this.$selectedChains();
    return (
      !!preview &&
      preview.draftsAllowed &&
      !this.$previewLoading() &&
      !this.$previewFailed() &&
      selectedChains.length > 0 &&
      selectedChains.length === this.$selectedChainIds().length &&
      selectedChains.every(chain => chain.updatable)
    );
  }

  private selectedChainsConfigured(): boolean {
    return (
      this.selectedChainsUpdatable() &&
      this.$selectedChains().every(chain => chain.differences.configured)
    );
  }

  private buildResolutions(): BuildingBlockReferenceUpdateChainResolutionDto[] {
    const value = this.resolutionForm.getRawValue() as ReferenceUpdateResolutionFormValue;

    return this.$selectedChainIds()
      .filter(chainId => !!value[chainId])
      .map(chainId => ({
        chainId,
        inputMappings: Object.entries(value[chainId].inputs ?? {})
          .map(([target, input]) => ({source: this.inputSource(input), target}))
          .filter(mapping => !!mapping.source),
        pluginConfigurations: Object.fromEntries(
          Object.entries(value[chainId].plugins ?? {}).filter(
            ([, configurationId]) => !!configurationId
          )
        ),
      }))
      .filter(
        resolution =>
          resolution.inputMappings.length > 0 ||
          Object.keys(resolution.pluginConfigurations).length > 0
      );
  }

  private inputSource(input: ReferenceUpdateInputFormValue | undefined): string {
    return ((input?.mode === 'value' ? input.value : input?.source) ?? '').trim();
  }

  private syncResolutionForm(): void {
    const selectedChains = this.$selectedChains();
    const selectedIds = selectedChains.map(chain => chain.id);

    Object.keys(this.resolutionForm.controls)
      .filter(chainId => !selectedIds.includes(chainId))
      .forEach(chainId => this.resolutionForm.removeControl(chainId, {emitEvent: false}));

    selectedChains.forEach(chain => {
      if (this.resolutionForm.contains(chain.id)) return;

      const inputs = this.fb.group({});
      chain.differences.missingRequiredInputs.forEach(field =>
        inputs.addControl(
          field,
          this.fb.group({
            mode: this.fb.control<ReferenceUpdateInputMode>('path'),
            source: this.fb.control(''),
            value: this.fb.control(''),
          }),
          {emitEvent: false}
        )
      );
      const plugins = this.fb.group({});
      chain.differences.missingPluginDefinitionKeys.forEach(pluginDefinitionKey =>
        plugins.addControl(pluginDefinitionKey, this.fb.control(''), {emitEvent: false})
      );
      this.resolutionForm.addControl(chain.id, this.fb.group({inputs, plugins}), {
        emitEvent: false,
      });
    });
  }

  private loadPluginConfigurations(): void {
    const loaded = this.$pluginConfigurations();
    const pluginDefinitionKeys = new Set(
      this.$selectedChains().flatMap(chain => chain.differences.missingPluginDefinitionKeys)
    );

    [...pluginDefinitionKeys]
      .filter(pluginDefinitionKey => !loaded[pluginDefinitionKey])
      .forEach(pluginDefinitionKey =>
        this.pluginManagementService
          .getPluginConfigurationsByPluginDefinitionKey(pluginDefinitionKey)
          .pipe(catchError(() => of([])))
          .subscribe(configurations =>
            this.$pluginConfigurations.update(current => ({
              ...current,
              [pluginDefinitionKey]: configurations,
            }))
          )
      );
  }

  private resetChains(): void {
    this._selectionInitialized = false;
    this.$preview.set(null);
    this.$previewFailed.set(false);
    this.$selectedChainIds.set([]);
    this.$confirmed.set(false);
    Object.keys(this.resolutionForm.controls).forEach(chainId =>
      this.resolutionForm.removeControl(chainId, {emitEvent: false})
    );
  }

  private reset(): void {
    this.$step.set(REFERENCE_UPDATE_STEPS[0]);
    this.$source.set(null);
    this.$targetKey.set(null);
    this.$target.set(null);
    this.$targetVersions.set(null);
    this.$result.set(null);
    this.$executing.set(false);
    this.$previewLoading.set(false);
    this.$pluginConfigurations.set({});
    this.resetChains();
  }

  private sameIds(left: string[], right: string[]): boolean {
    return left.length === right.length && left.every(id => right.includes(id));
  }
}
