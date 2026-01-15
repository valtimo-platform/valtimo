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

import {Component, OnDestroy, OnInit} from '@angular/core';
import {
  ProcessLinkBuildingBlockApiService,
  ProcessLinkButtonService,
  ProcessLinkService,
  ProcessLinkStateService,
  ProcessLinkStepService,
} from '../../services';
import {BuildingBlockStateService} from '../../services/building-block-state.service';
import {
  PluginConfiguration,
  PluginManagementService,
  PluginTranslationService,
} from '@valtimo/plugin';
import {
  BuildingBlockProcessLinkCreateDto,
  BuildingBlockProcessLinkUpdateDto,
  PluginConfigurationViewModel,
  ProcessLink,
  ProcessLinkType,
} from '../../models';
import {combineLatest, distinctUntilChanged, Observable, of, shareReplay, Subscription} from 'rxjs';
import {catchError, map, switchMap, take} from 'rxjs/operators';
import {ListItem} from 'carbon-components-angular/dropdown';
import {TranslateService} from '@ngx-translate/core';
import {NotificationContent} from 'carbon-components-angular';

@Component({
  standalone: false,
  selector: 'valtimo-configure-building-block-plugins',
  templateUrl: './configure-building-block-plugins.component.html',
  styleUrls: ['./configure-building-block-plugins.component.scss'],
})
export class ConfigureBuildingBlockPluginsComponent implements OnInit, OnDestroy {
  public readonly pluginKeys$ = this.buildingBlockStateService.requiredPluginKeys$;
  public readonly isNestedBuildingBlock$ = this.buildingBlockStateService.isNestedBuildingBlock$;
  private readonly _pluginDependenciesWarningTranslationKey$: Observable<string> =
    this.buildingBlockStateService.pluginDependencies$.pipe(
      map(dependencies => {
        if (!dependencies || !dependencies.length) return '';

        const zaakInstanceLinkDependency = dependencies.includes('ZAAK_INSTANCE_LINK');
        const zaakTypeLinkDependency = dependencies.includes('ZAAK_TYPE_LINK');

        if (zaakInstanceLinkDependency && zaakTypeLinkDependency) {
          return 'processLinkConfiguration.buildingBlock.pluginDependenciesWarning.zaakInstanceAndTypeLink';
        } else if (zaakInstanceLinkDependency) {
          return 'processLinkConfiguration.buildingBlock.pluginDependenciesWarning.zaakInstanceLink';
        } else if (zaakTypeLinkDependency) {
          return 'processLinkConfiguration.buildingBlock.pluginDependenciesWarning.zaakTypeLink';
        } else {
          return '';
        }
      })
    );

  public readonly dependenciesNotificationObject$: Observable<NotificationContent> = combineLatest([
    this._pluginDependenciesWarningTranslationKey$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([warningTranslationKey]) =>
      !warningTranslationKey
        ? null
        : {
            type: 'warning',
            lowContrast: true,
            title: this.translateService.instant(
              'processLinkConfiguration.buildingBlock.pluginDependenciesWarning.title'
            ),
            message: this.translateService.instant(warningTranslationKey),
            showClose: false,
          }
    )
  );
  public readonly loading$ = this.buildingBlockStateService.requirementsLoading$;
  public readonly versions$ = this.buildingBlockStateService.versions$;
  public readonly definitionVersionTag$ = this.buildingBlockStateService.definitionVersionTag$;
  public readonly versionPlaceholder$ = this.translateService.stream(
    'processLinkConfiguration.buildingBlock.versionPlaceholder'
  );
  public readonly configurationPlaceholder$ = this.translateService.stream(
    'processLinkConfiguration.buildingBlock.configurationPlaceholder'
  );
  public readonly versionItems$: Observable<Array<ListItem>> = combineLatest([
    this.versions$,
    this.definitionVersionTag$,
    this.versionPlaceholder$,
  ]).pipe(
    map(([versions, selectedVersion, placeholder]) => {
      const normalizedSelectedVersion = selectedVersion || '';
      return [
        {
          id: '',
          content: placeholder,
          selected: normalizedSelectedVersion === '',
        },
        ...(versions || []).map(
          version =>
            ({
              id: version,
              content: version,
              selected: normalizedSelectedVersion === version,
            }) as ListItem
        ),
      ];
    })
  );
  public readonly pluginConfigurationViewModels$: Observable<Array<PluginConfigurationViewModel>> =
    combineLatest([
      this.pluginKeys$,
      this.buildingBlockStateService.pluginMappings$,
      this.configurationPlaceholder$,
    ]).pipe(
      switchMap(([pluginKeys, pluginMappings, placeholder]) => {
        if (!pluginKeys?.length) {
          return of([]);
        }

        return combineLatest(
          pluginKeys.map(pluginKey =>
            this.getConfigurationOptions(pluginKey).pipe(
              map(options => ({
                key: pluginKey,
                label: this.pluginLabel(pluginKey),
                dropdownItems: this.buildDropdownItems(
                  options,
                  pluginMappings?.[pluginKey],
                  placeholder
                ),
                hasOptions: options.length > 0,
              }))
            )
          )
        );
      })
    );

  private readonly _subscriptions = new Subscription();
  private readonly _configurationOptionsCache = new Map<
    string,
    Observable<Array<PluginConfiguration>>
  >();

  constructor(
    private readonly stateService: ProcessLinkStateService,
    private readonly buildingBlockStateService: BuildingBlockStateService,
    private readonly buttonService: ProcessLinkButtonService,
    private readonly stepService: ProcessLinkStepService,
    private readonly pluginManagementService: PluginManagementService,
    private readonly pluginTranslationService: PluginTranslationService,
    private readonly processLinkService: ProcessLinkService,
    private readonly translateService: TranslateService,
    private readonly processLinkBuildingBlockApiService: ProcessLinkBuildingBlockApiService
  ) {}

  public ngOnInit(): void {
    // Check if we're configuring from within a building block process (nested building block)
    this._subscriptions.add(
      this.stateService.modalParams$
        .pipe(
          map(params => params?.processDefinitionId),
          distinctUntilChanged()
        )
        .subscribe(processDefinitionId => {
          if (processDefinitionId) {
            this.processLinkBuildingBlockApiService
              .isBuildingBlockProcess(processDefinitionId)
              .subscribe(isNested => {
                this.buildingBlockStateService.setIsNestedBuildingBlock(isNested);
              });
          }
        })
    );

    this._subscriptions.add(
      combineLatest([
        this.buildingBlockStateService.requiredPluginKeys$,
        this.buildingBlockStateService.mappingsComplete$,
        this.buildingBlockStateService.requirementsLoading$,
        this.definitionVersionTag$,
      ]).subscribe(([keys, complete, loading, version]) => {
        if (loading || !version) {
          this.buttonService.disableNextButton();
          return;
        }

        if (keys.length === 0 || complete) {
          this.buttonService.enableNextButton();
        } else {
          this.buttonService.disableNextButton();
        }
      })
    );

    this._subscriptions.add(
      this.buttonService.backButtonClick$.subscribe(() => {
        this.stepService.setBuildingBlockSteps();
      })
    );

    this._subscriptions.add(
      this.buttonService.nextButtonClick$.subscribe(() => {
        this.stepService.setConfigureBuildingBlockMappingsStep(
          this.buildingBlockStateService.getDefinitionSnapshot().key ?? undefined
        );
      })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  private getConfigurationOptions(
    pluginDefinitionKey: string
  ): Observable<Array<PluginConfiguration>> {
    if (!this._configurationOptionsCache.has(pluginDefinitionKey)) {
      this._configurationOptionsCache.set(
        pluginDefinitionKey,
        this.pluginManagementService
          .getPluginConfigurationsByPluginDefinitionKey(pluginDefinitionKey)
          .pipe(
            catchError(() => of([])),
            shareReplay(1)
          )
      );
    }
    return this._configurationOptionsCache.get(pluginDefinitionKey) ?? of([]);
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

  private buildDropdownItems(
    options: Array<PluginConfiguration>,
    selectedId: string | null | undefined,
    placeholder: string
  ): Array<ListItem> {
    return [
      {
        id: '',
        content: placeholder,
        selected: !selectedId,
      },
      ...options.map(
        option =>
          ({
            id: option.id,
            content: option.title,
            selected: selectedId === option.id || (options.length === 1 && !selectedId),
          }) as ListItem
      ),
    ];
  }

  private checkSingleBuildingBlockType(types: Array<ProcessLinkType>): boolean {
    if (!types?.length) return false;
    return types.length === 1 && types[0]?.processLinkType === 'building-block' && types[0].enabled;
  }

  public onVersionChange(versionTag: string): void {
    const normalizedValue = versionTag || null;
    this.buildingBlockStateService.setPluginConfigurationMappings(undefined);
    this.buildingBlockStateService.setDefinitionVersionTag(normalizedValue);
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
        inputMappings: [],
        outputMappings: [],
      };

      this.stateService.sendProcessLinkCreateEvent(request);
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
        inputMappings: [],
        outputMappings: [],
      };

      this.stateService.sendProcessLinkUpdateEvent(request);
    });
  }

  private getMappingsForPayload(): Record<string, string> {
    const mappings = this.buildingBlockStateService.getPluginConfigurationMappingsSnapshot();
    return Object.entries(mappings).reduce(
      (acc, [pluginKey, configurationId]) => {
        if (configurationId) acc[pluginKey] = configurationId;
        return acc;
      },
      {} as Record<string, string>
    );
  }
}
