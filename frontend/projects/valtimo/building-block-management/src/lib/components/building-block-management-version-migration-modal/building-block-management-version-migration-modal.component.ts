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

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormBuilder, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {runAfterCarbonModalClosed, ValtimoCdsModalDirective} from '@valtimo/components';
import {PluginConfiguration, PluginManagementService} from '@valtimo/plugin';
import {
  BuildingBlockInUseVersionDto,
  BuildingBlockVersionDto,
  BuildingBlockVersionMigrationChainDto,
  BuildingBlockVersionMigrationChainResolutionDto,
  BuildingBlockVersionMigrationContainerDto,
  BuildingBlockVersionMigrationContainerType,
  BuildingBlockVersionMigrationExecuteRequestDto,
  BuildingBlockVersionMigrationPreviewDto,
  BuildingBlockVersionMigrationPreviewRequestDto,
  BuildingBlockVersionMigrationReferenceDto,
  BuildingBlockVersionMigrationResultDto,
} from '@valtimo/shared';
import {
  ButtonModule,
  CheckboxModule,
  DropdownModule,
  InputModule,
  LoadingModule,
  ModalModule,
  NotificationModule,
  ProgressIndicatorModule,
  SelectModule,
  TagModule,
} from 'carbon-components-angular';
import {catchError, debounceTime, filter, of, Subject, Subscription, switchMap, tap} from 'rxjs';
import {
  BUILDING_BLOCK_MANAGEMENT_TABS,
  BUILDING_BLOCK_MANAGEMENT_VERSION_MIGRATION_TEST_IDS,
  BUILDING_BLOCK_VERSION_MIGRATION_SOURCE_OPTION_TEST_ID_PREFIX,
  BUILDING_BLOCK_VERSION_MIGRATION_TARGET_OPTION_TEST_ID_PREFIX,
  VERSION_MIGRATION_PREVIEW_DEBOUNCE_MS,
  VERSION_MIGRATION_STEP,
  VERSION_MIGRATION_STEPS,
} from '../../constants';
import {VersionMigrationResolutionFormValue, VersionMigrationVersionListItem} from '../../models';
import {
  BuildingBlockManagementApiService,
  BuildingBlockManagementService,
  BuildingBlockVersionMigrationApiService,
} from '../../services';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-management-version-migration-modal',
  templateUrl: './building-block-management-version-migration-modal.component.html',
  styleUrls: ['./building-block-management-version-migration-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TranslateModule,
    ButtonModule,
    CheckboxModule,
    DropdownModule,
    InputModule,
    LoadingModule,
    ModalModule,
    NotificationModule,
    ProgressIndicatorModule,
    SelectModule,
    TagModule,
    ValtimoCdsModalDirective,
  ],
})
export class BuildingBlockManagementVersionMigrationModalComponent implements OnInit, OnDestroy {
  protected readonly testIds = BUILDING_BLOCK_MANAGEMENT_VERSION_MIGRATION_TEST_IDS;

  public readonly STEP = VERSION_MIGRATION_STEP;

  public readonly resolutionForm: FormGroup = this.fb.group({});

  public readonly showModal$ = this.buildingBlockManagementService.showVersionMigrationModal$;

  public readonly $step = signal<VERSION_MIGRATION_STEP>(VERSION_MIGRATION_STEP.SOURCE);
  public readonly $inUseVersions = signal<BuildingBlockInUseVersionDto[] | null>(null);
  public readonly $source = signal<BuildingBlockInUseVersionDto | null>(null);
  public readonly $targetVersions = signal<BuildingBlockVersionDto[] | null>(null);
  public readonly $target = signal<string | null>(null);
  public readonly $preview = signal<BuildingBlockVersionMigrationPreviewDto | null>(null);
  public readonly $previewLoading = signal<boolean>(false);
  public readonly $previewFailed = signal<boolean>(false);
  public readonly $selectedChainIds = signal<string[]>([]);
  public readonly $pluginConfigurations = signal<Record<string, PluginConfiguration[]>>({});
  public readonly $confirmed = signal<boolean>(false);
  public readonly $executing = signal<boolean>(false);
  public readonly $result = signal<BuildingBlockVersionMigrationResultDto | null>(null);

  public readonly $currentStepIndex = computed(() => VERSION_MIGRATION_STEPS.indexOf(this.$step()));

  public readonly $progressSteps = computed(() => {
    const currentIndex = this.$currentStepIndex();
    const finished = this.$result() !== null;
    return this._$stepLabels().map((label, index) => ({
      label,
      complete: finished || index < currentIndex,
    }));
  });

  public readonly $sourceItems = computed((): VersionMigrationVersionListItem[] => {
    const source = this.$source();
    return (this.$inUseVersions() ?? []).map(version => ({
      id: this.sourceItemId(version),
      content: `${version.name ? `${version.name} (${version.key})` : version.key} ${version.versionTag}`,
      selected: !!source && this.sourceItemId(source) === this.sourceItemId(version),
      final: version.final,
      'data-test-id': `${BUILDING_BLOCK_VERSION_MIGRATION_SOURCE_OPTION_TEST_ID_PREFIX}${version.key}-${version.versionTag}`,
    }));
  });

  public readonly $targetItems = computed((): VersionMigrationVersionListItem[] => {
    const sourceVersionTag = this.$source()?.versionTag;
    const target = this.$target();
    return (this.$targetVersions() ?? [])
      .filter(version => version.versionTag !== sourceVersionTag)
      .map(version => ({
        id: version.versionTag,
        content: version.versionTag,
        selected: version.versionTag === target,
        final: version.final,
        'data-test-id': `${BUILDING_BLOCK_VERSION_MIGRATION_TARGET_OPTION_TEST_ID_PREFIX}${version.versionTag}`,
      }));
  });

  public readonly $selectedChains = computed((): BuildingBlockVersionMigrationChainDto[] => {
    const selectedIds = this.$selectedChainIds();
    return (this.$preview()?.chains ?? []).filter(chain => selectedIds.includes(chain.id));
  });

  public readonly $canProceed = computed((): boolean => {
    switch (this.$step()) {
      case VERSION_MIGRATION_STEP.SOURCE:
        return this.$source() !== null;
      case VERSION_MIGRATION_STEP.TARGET:
        return this.$target() !== null && this.$target() !== this.$source()?.versionTag;
      case VERSION_MIGRATION_STEP.CHAINS:
        return this.selectedChainsMigratable();
      case VERSION_MIGRATION_STEP.DIFFERENCES:
        return this.selectedChainsConfigured();
      case VERSION_MIGRATION_STEP.REVIEW:
        return this.selectedChainsConfigured() && this.$confirmed() && !this.$executing();
      default:
        return false;
    }
  });

  private _selectionInitialized = false;

  private readonly _$stepLabels = signal<string[]>([]);
  private readonly _previewRequests$ =
    new Subject<BuildingBlockVersionMigrationPreviewRequestDto>();
  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly buildingBlockManagementApiService: BuildingBlockManagementApiService,
    private readonly buildingBlockManagementService: BuildingBlockManagementService,
    private readonly buildingBlockVersionMigrationApiService: BuildingBlockVersionMigrationApiService,
    private readonly fb: FormBuilder,
    private readonly pluginManagementService: PluginManagementService,
    private readonly translateService: TranslateService
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      this.translateService
        .stream(
          VERSION_MIGRATION_STEPS.map(
            step => `buildingBlockManagement.versionMigration.steps.${step}`
          )
        )
        .subscribe((labels: Record<string, string>) => this._$stepLabels.set(Object.values(labels)))
    );

    this._subscriptions.add(
      this.showModal$.pipe(filter(show => !!show)).subscribe(() => this.loadInUseVersions())
    );

    this._subscriptions.add(
      this._previewRequests$
        .pipe(
          switchMap(request =>
            this.buildingBlockVersionMigrationApiService
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
          debounceTime(VERSION_MIGRATION_PREVIEW_DEBOUNCE_MS)
        )
        .subscribe(() => this.requestPreview())
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onCloseModal(): void {
    this.buildingBlockManagementService.hideVersionMigrationModal();
    runAfterCarbonModalClosed(() => this.resetModal());
  }

  public onBackClick(): void {
    const previousStep = VERSION_MIGRATION_STEPS[this.$currentStepIndex() - 1];
    if (!previousStep || this.$result() !== null) return;

    this.$confirmed.set(false);
    this.$step.set(previousStep);
  }

  public onNextClick(): void {
    const nextStep = VERSION_MIGRATION_STEPS[this.$currentStepIndex() + 1];
    if (!nextStep || !this.$canProceed()) return;

    this.$step.set(nextStep);

    switch (nextStep) {
      case VERSION_MIGRATION_STEP.CHAINS:
        if (this.$preview() === null) this.requestPreview();
        break;
      case VERSION_MIGRATION_STEP.DIFFERENCES:
        this.syncResolutionForm();
        this.loadPluginConfigurations();
        this.requestPreview();
        break;
      case VERSION_MIGRATION_STEP.REVIEW:
        this.$confirmed.set(false);
        break;
    }
  }

  public onSourceSelected(event: {item?: {id?: string}}): void {
    const source = (this.$inUseVersions() ?? []).find(
      version => this.sourceItemId(version) === event?.item?.id
    );
    if (!source || this.sourceItemId(source) === this.sourceItemId(this.$source())) return;

    this.$source.set(source);
    this.$target.set(null);
    this.$targetVersions.set(null);
    this.resetChains();

    this.buildingBlockManagementApiService
      .getVersionsForBuildingBlock(source.key, 0, 10, true)
      .subscribe({
        next: versions => this.$targetVersions.set(versions.content),
        error: () => this.$targetVersions.set([]),
      });
  }

  public onTargetSelected(event: {item?: {id?: string}}): void {
    const target = event?.item?.id;
    if (!target || target === this.$target()) return;

    this.$target.set(target);
    this.resetChains();
  }

  public onChainCheckedChange(chainId: string, checked: boolean): void {
    const selected = this.$selectedChainIds().filter(id => id !== chainId);
    this.$selectedChainIds.set(checked ? [...selected, chainId] : selected);
    this.requestPreview();
  }

  public onConfirmedChange(confirmed: boolean): void {
    this.$confirmed.set(confirmed);
  }

  public onExecute(): void {
    if (this.$step() !== VERSION_MIGRATION_STEP.REVIEW || !this.$canProceed()) return;

    this.$executing.set(true);
    this.buildingBlockVersionMigrationApiService.execute(this.buildExecuteRequest()).subscribe({
      next: result => {
        this.$executing.set(false);
        this.$result.set(result);
        this.buildingBlockManagementService.reload();
      },
      error: () => this.$executing.set(false),
    });
  }

  public buildExecuteRequest(): BuildingBlockVersionMigrationExecuteRequestDto {
    return {
      key: this.$source()?.key ?? '',
      sourceVersionTag: this.$source()?.versionTag ?? '',
      targetVersionTag: this.$target() ?? '',
      selectedChainIds: [...this.$selectedChainIds()],
      resolutions: this.buildResolutions(),
    };
  }

  public isChainSelected(chainId: string): boolean {
    return this.$selectedChainIds().includes(chainId);
  }

  public chainLabel(chainId: string): string {
    const chain = this.$preview()?.chains.find(candidate => candidate.id === chainId);
    if (!chain) return chainId;

    return [
      ...chain.containers.map(container => this.containerLabel(container)),
      `${chain.link.buildingBlockKey} ${chain.link.buildingBlockVersionTag}`,
    ].join(' › ');
  }

  public containerLabel(container: {key: string; versionTag: string}): string {
    return `${container.key} ${container.versionTag}`;
  }

  public referenceLabel(reference: BuildingBlockVersionMigrationReferenceDto): string {
    const activity = reference.activityId ? ` (${reference.activityId})` : '';
    return `${this.containerLabel(reference.container)}${activity} › ${reference.buildingBlockKey} ${reference.buildingBlockVersionTag}`;
  }

  public draftRoute(draft: {
    type: BuildingBlockVersionMigrationContainerType;
    key: string;
    versionTag: string;
  }): string[] {
    return draft.type === 'CASE'
      ? ['/case-management', 'case', draft.key, 'version', draft.versionTag, 'general']
      : [
          '/building-block-management',
          'building-block',
          draft.key,
          'version',
          draft.versionTag,
          BUILDING_BLOCK_MANAGEMENT_TABS.GENERAL,
        ];
  }

  public containerTypeKey(container: BuildingBlockVersionMigrationContainerDto): string {
    return `buildingBlockManagement.versionMigration.containerType.${container.type}`;
  }

  private sourceItemId(version: {key: string; versionTag: string} | null): string {
    return version ? `${version.key}:${version.versionTag}` : '';
  }

  private loadInUseVersions(): void {
    this.$inUseVersions.set(null);
    this.buildingBlockVersionMigrationApiService.getInUseVersions().subscribe({
      next: versions => this.$inUseVersions.set(versions),
      error: () => this.$inUseVersions.set([]),
    });
  }

  private requestPreview(): void {
    const source = this.$source();
    const target = this.$target();
    if (!source || !target) return;

    this.$previewLoading.set(true);
    this._previewRequests$.next({
      key: source.key,
      sourceVersionTag: source.versionTag,
      targetVersionTag: target,
      selectedChainIds: this._selectionInitialized ? [...this.$selectedChainIds()] : null,
      resolutions: this.buildResolutions(),
    });
  }

  private onPreviewLoaded(preview: BuildingBlockVersionMigrationPreviewDto | null): void {
    this.$previewLoading.set(false);
    this.$previewFailed.set(preview === null);
    if (!preview || !this.previewMatchesSelection(preview)) return;

    this.$preview.set(preview);
    if (this._selectionInitialized) return;

    this._selectionInitialized = true;
    const defaults = preview.chains
      .filter(chain => chain.selectedByDefault && chain.migratable)
      .map(chain => chain.id);
    const selectedByServer = preview.chains.filter(chain => chain.selected).map(chain => chain.id);
    this.$selectedChainIds.set(defaults);

    if (!this.sameIds(defaults, selectedByServer)) this.requestPreview();
  }

  private previewMatchesSelection(preview: BuildingBlockVersionMigrationPreviewDto): boolean {
    return (
      preview.key === this.$source()?.key &&
      preview.sourceVersionTag === this.$source()?.versionTag &&
      preview.targetVersionTag === this.$target()
    );
  }

  private selectedChainsMigratable(): boolean {
    const preview = this.$preview();
    const selectedChains = this.$selectedChains();
    return (
      !!preview &&
      preview.draftsAllowed &&
      !this.$previewLoading() &&
      !this.$previewFailed() &&
      selectedChains.length > 0 &&
      selectedChains.length === this.$selectedChainIds().length &&
      selectedChains.every(chain => chain.migratable)
    );
  }

  private selectedChainsConfigured(): boolean {
    return (
      this.selectedChainsMigratable() &&
      this.$selectedChains().every(chain => chain.differences.configured)
    );
  }

  private buildResolutions(): BuildingBlockVersionMigrationChainResolutionDto[] {
    const value = this.resolutionForm.getRawValue() as VersionMigrationResolutionFormValue;

    return this.$selectedChainIds()
      .filter(chainId => !!value[chainId])
      .map(chainId => ({
        chainId,
        inputMappings: Object.entries(value[chainId].inputs ?? {})
          .filter(([, source]) => !!source?.trim())
          .map(([target, source]) => ({source: source.trim(), target})),
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
        inputs.addControl(field, this.fb.control(''), {emitEvent: false})
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

  private resetModal(): void {
    this.$step.set(VERSION_MIGRATION_STEP.SOURCE);
    this.$source.set(null);
    this.$target.set(null);
    this.$targetVersions.set(null);
    this.$result.set(null);
    this.$executing.set(false);
    this.resetChains();
  }

  private sameIds(left: string[], right: string[]): boolean {
    return left.length === right.length && left.every(id => right.includes(id));
  }
}
