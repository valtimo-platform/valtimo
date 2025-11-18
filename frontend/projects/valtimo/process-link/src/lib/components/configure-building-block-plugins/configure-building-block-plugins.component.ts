/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Component, OnDestroy, OnInit} from '@angular/core';
import {
  ProcessLinkButtonService,
  ProcessLinkService,
  ProcessLinkStateService,
  ProcessLinkStepService,
} from '../../services';
import {BuildingBlockStateService} from '../../services/building-block-state.service';
import {PluginConfiguration, PluginManagementService, PluginTranslationService} from '@valtimo/plugin';
import {
  BuildingBlockProcessLinkCreateDto,
  BuildingBlockProcessLinkUpdateDto,
  ProcessLink,
  ProcessLinkEditMode,
  ProcessLinkType,
} from '../../models';
import {combineLatest, Observable, of, shareReplay, Subscription} from 'rxjs';
import {catchError, take} from 'rxjs/operators';

@Component({
  standalone: false,
  selector: 'valtimo-configure-building-block-plugins',
  templateUrl: './configure-building-block-plugins.component.html',
  styleUrls: ['./configure-building-block-plugins.component.scss'],
})
export class ConfigureBuildingBlockPluginsComponent implements OnInit, OnDestroy {
  public readonly pluginKeys$ = this.buildingBlockStateService.requiredPluginKeys$;
  public readonly loading$ = this.buildingBlockStateService.requirementsLoading$;
  public readonly versions$ = this.buildingBlockStateService.versions$;

  public selectedMappings: Record<string, string | null> = {};
  public selectedVersion: string | null = null;

  private readonly subscriptions = new Subscription();
  private readonly configurationOptionsCache = new Map<
    string,
    Observable<Array<PluginConfiguration>>
  >();
  private hasSingleProcessLinkType = false;

  constructor(
    private readonly stateService: ProcessLinkStateService,
    private readonly buildingBlockStateService: BuildingBlockStateService,
    private readonly buttonService: ProcessLinkButtonService,
    private readonly stepService: ProcessLinkStepService,
    private readonly pluginManagementService: PluginManagementService,
    private readonly pluginTranslationService: PluginTranslationService,
    private readonly processLinkService: ProcessLinkService
  ) {}

  public ngOnInit(): void {
    this.subscriptions.add(
      this.buildingBlockStateService.pluginMappings$.subscribe(mappings => {
        this.selectedMappings = {...mappings};
      })
    );

    this.subscriptions.add(
      this.buildingBlockStateService.definitionVersionTag$.subscribe(version => {
        this.selectedVersion = version;
      })
    );

    this.subscriptions.add(
      combineLatest([
        this.buildingBlockStateService.requiredPluginKeys$,
        this.buildingBlockStateService.mappingsComplete$,
        this.buildingBlockStateService.requirementsLoading$,
        this.buildingBlockStateService.definitionVersionTag$,
      ]).subscribe(([keys, complete, loading, version]) => {
        if (loading || !version) {
          this.buttonService.disableSaveButton();
          return;
        }

        if (keys.length === 0 || complete) {
          this.buttonService.enableSaveButton();
        } else {
          this.buttonService.disableSaveButton();
        }
      })
    );

    this.subscriptions.add(
      this.buttonService.backButtonClick$.subscribe(() => {
        if (this.hasSingleProcessLinkType) {
          this.stepService.setSingleBuildingBlockSteps();
        } else {
          this.stepService.setBuildingBlockSteps();
        }
      })
    );

    this.subscriptions.add(
      this.buttonService.saveButtonClick$.subscribe(() => {
        this.persistProcessLink();
      })
    );

    this.subscriptions.add(
      this.stateService.availableProcessLinkTypes$.subscribe(types => {
        this.hasSingleProcessLinkType = this.checkSingleBuildingBlockType(types);
      })
    );
  }

  public ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  public optionsFor(pluginDefinitionKey: string): Observable<Array<PluginConfiguration>> {
    if (!this.configurationOptionsCache.has(pluginDefinitionKey)) {
      this.configurationOptionsCache.set(
        pluginDefinitionKey,
        this.pluginManagementService
          .getPluginConfigurationsByPluginDefinitionKey(pluginDefinitionKey)
          .pipe(catchError(() => of([])), shareReplay(1))
      );
    }
    return this.configurationOptionsCache.get(pluginDefinitionKey) ?? of([]);
  }

  public onMappingChange(pluginDefinitionKey: string, configurationId: string): void {
    const normalizedValue = configurationId || null;
    this.buildingBlockStateService.setPluginConfigurationMapping(
      pluginDefinitionKey,
      normalizedValue
    );
  }

  public pluginLabel(pluginDefinitionKey: string): string {
    return (
      this.pluginTranslationService.instant('title', pluginDefinitionKey) || pluginDefinitionKey
    );
  }

  public isInvalidSelection(
    pluginDefinitionKey: string,
    options: Array<PluginConfiguration> | null | undefined
  ): boolean {
    if (!options) return false;
    if (options.length === 0) return true;
    return !this.selectedMappings[pluginDefinitionKey];
  }

  public trackByPluginKey(_: number, pluginKey: string): string {
    return pluginKey;
  }

  private checkSingleBuildingBlockType(types: Array<ProcessLinkType>): boolean {
    if (!types?.length) return false;
    return (
      types.length === 1 &&
      types[0]?.processLinkType === 'building-block' &&
      types[0].enabled
    );
  }

  public onVersionChange(versionTag: string): void {
    const normalizedValue = versionTag || null;
    this.buildingBlockStateService.setPluginConfigurationMappings(undefined);
    this.buildingBlockStateService.setDefinitionVersionTag(normalizedValue);
  }

  private persistProcessLink(): void {
    this.stateService.startSaving();
    this.stateService.selectedProcessLink$.pipe(take(1)).subscribe(selectedProcessLink => {
      if (selectedProcessLink && selectedProcessLink.processLinkType === 'building-block') {
        this.updateProcessLink(selectedProcessLink);
      } else {
        this.createProcessLink();
      }
    });
  }

  private createProcessLink(): void {
    this.stateService.modalParams$.pipe(take(1)).subscribe(modalParams => {
      const {key, versionTag} = this.buildingBlockStateService.getDefinitionSnapshot();
      if (!modalParams || !key || !versionTag) {
        this.stateService.stopSaving();
        return;
      }

      const activityId = modalParams.element?.id;
      const processDefinitionId = modalParams.processDefinitionId;

      if (!activityId || !processDefinitionId) {
        this.stateService.stopSaving();
        return;
      }

      const request: BuildingBlockProcessLinkCreateDto = {
        processDefinitionId,
        activityId,
        activityType: modalParams.element?.activityListenerType ?? '',
        processLinkType: 'building-block',
        buildingBlockDefinitionKey: key,
        buildingBlockDefinitionVersionTag: versionTag,
        pluginConfigurationMappings: this.getMappingsForPayload(),
      };

      if (this.stateService.processLinkEditMode === ProcessLinkEditMode.EMIT_EVENTS) {
        this.stateService.sendProcessLinkCreateEvent(request);
        return;
      }

      this.processLinkService.saveProcessLink(request).subscribe({
        next: () => this.stateService.closeModal(),
        error: () => this.stateService.stopSaving(),
      });
    });
  }

  private updateProcessLink(processLink: ProcessLink): void {
    this.stateService.modalParams$.pipe(take(1)).subscribe(modalParams => {
      const {key, versionTag} = this.buildingBlockStateService.getDefinitionSnapshot();
      if (!modalParams || !key || !versionTag) {
        this.stateService.stopSaving();
        return;
      }

      const activityId = modalParams.element?.id;

      const request: BuildingBlockProcessLinkUpdateDto = {
        id: processLink.id,
        activityId: activityId,
        processLinkType: 'building-block',
        buildingBlockDefinitionKey: key,
        buildingBlockDefinitionVersionTag: versionTag,
        pluginConfigurationMappings: this.getMappingsForPayload(),
      };

      if (this.stateService.processLinkEditMode === ProcessLinkEditMode.EMIT_EVENTS) {
        this.stateService.sendProcessLinkUpdateEvent(request);
        return;
      }

      this.processLinkService.updateProcessLink(request).subscribe({
        next: () => this.stateService.closeModal(),
        error: () => this.stateService.stopSaving(),
      });
    });
  }

  private getMappingsForPayload(): Record<string, string> {
    const mappings = this.buildingBlockStateService.getPluginConfigurationMappingsSnapshot();
    return Object.entries(mappings).reduce((acc, [pluginKey, configurationId]) => {
      if (configurationId) acc[pluginKey] = configurationId;
      return acc;
    }, {} as Record<string, string>);
  }
}
