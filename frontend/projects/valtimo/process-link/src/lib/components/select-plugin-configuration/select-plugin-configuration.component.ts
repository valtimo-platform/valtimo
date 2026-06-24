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
import {TranslateService} from '@ngx-translate/core';
import {catchError, filter, map, switchMap, take, withLatestFrom} from 'rxjs/operators';
import {PluginStateService} from '../../services/plugin-state.service';
import {combineLatest, Observable, of, Subscription} from 'rxjs';
import {
  ExternalPluginConfiguration,
  ExternalPluginDefinition,
  ExternalPluginService,
  getExternalPluginDescription,
  getExternalPluginDisplayName,
  getExternalPluginName,
  PluginConfiguration,
  PluginDefinition,
  PluginManagementService,
  PluginService,
  PluginTranslationService,
  toExternalPluginKey,
} from '@valtimo/plugin';
import {
  ProcessLinkButtonService,
  ProcessLinkStateService,
  ProcessLinkStepService,
} from '../../services';
import {PluginListItem} from '../../models';

@Component({
  standalone: false,
  selector: 'valtimo-select-plugin-configuration',
  templateUrl: './select-plugin-configuration.component.html',
  styleUrls: ['./select-plugin-configuration.component.scss'],
})
export class SelectPluginConfigurationComponent implements OnInit, OnDestroy {
  public readonly isBuildingBlockContext$ = this._stateService.context$.pipe(
    map(context => context === 'buildingBlock')
  );

  public readonly listItems$: Observable<PluginListItem[] | undefined> = combineLatest([
    this.isBuildingBlockContext$,
    this._stateService.modalParams$,
  ]).pipe(
    switchMap(([isBuildingBlock, modalData]) =>
      isBuildingBlock
        ? combineLatest([
            this._pluginManagementService.getPluginDefinitions(
              modalData?.element?.activityListenerType
            ),
            this._pluginService.pluginSpecifications$,
          ]).pipe(
            map(([definitions, specs]) => {
              const limitedDefinitions =
                definitions?.filter(definition =>
                  specs.some(spec => spec.pluginId === definition.key)
                ) ?? [];
              const enriched: PluginListItem[] = limitedDefinitions.map(definition => {
                const spec = specs.find(item => item.pluginId === definition.key);
                return {
                  id: definition.key,
                  title:
                    this._pluginTranslationService.instant('title', definition.key) ||
                    definition.title,
                  description:
                    this._pluginTranslationService.instant('description', definition.key) ||
                    definition.description,
                  logo: spec?.pluginLogoBase64 ?? null,
                  payload: definition.key,
                  isDefinition: true,
                };
              });
              this._pluginDefinitionsCache = limitedDefinitions;
              return enriched;
            })
          )
        : combineLatest([
            modalData?.element?.type
              ? this._pluginManagementService.getAllPluginConfigurationsWithLogos(
                  modalData?.element?.activityListenerType
                )
              : of(undefined),
            this._pluginService.availablePluginIds$,
            this._externalPluginService.getConfigurations().pipe(catchError(() => of([] as ExternalPluginConfiguration[]))),
            this._externalPluginService.getDefinitions().pipe(catchError(() => of([] as ExternalPluginDefinition[]))),
            this._translateService.stream('key'),
          ]).pipe(
            map(([configs, availablePluginIds, externalConfigs, externalDefinitions]) => {
              const lang = this._translateService.currentLang;
              const embeddedItems: PluginListItem[] =
                configs
                  ?.filter(configuration =>
                    availablePluginIds.includes(configuration.pluginDefinition.key)
                  )
                  ?.map(configuration => ({
                    id: configuration.id ?? configuration.title,
                    title: configuration.title,
                    description: this._pluginTranslationService.instant(
                      'description',
                      configuration.pluginDefinition.key
                    ),
                    logo: (configuration.pluginLogoBase64 as string) ?? null,
                    payload: configuration,
                    isDefinition: false,
                  })) ?? [];

              const externalItems: PluginListItem[] = externalConfigs.map(extConfig => {
                const def = externalDefinitions.find(d => d.id === extConfig.definitionId);
                return {
                  id: extConfig.id,
                  title: extConfig.title,
                  description: def ? getExternalPluginDisplayName(def, lang) : 'External plugin',
                  logo: def?.logoUrl ?? null,
                  payload: {
                    id: extConfig.id,
                    title: extConfig.title,
                    pluginDefinition: {
                      key: toExternalPluginKey(extConfig.definitionId),
                      title: def ? getExternalPluginName(def, lang) : extConfig.definitionId,
                      description: def ? (getExternalPluginDescription(def, lang) ?? '') : '',
                    },
                    properties: {},
                  } as PluginConfiguration,
                  isDefinition: false,
                  external: true,
                  externalConfigurationId: extConfig.id,
                  externalDefinitionId: extConfig.definitionId,
                };
              });

              return [...embeddedItems, ...externalItems];
            })
          )
    )
  );

  public readonly pageHeaderText$ = this.isBuildingBlockContext$.pipe(
    map(isBuildingBlock =>
      isBuildingBlock
        ? 'processLinkConfiguration.choosePluginDefinitionDescription'
        : 'processLinkConfiguration.choosePluginConfigurationDescription'
    )
  );

  public readonly columnHeaderText$ = this.isBuildingBlockContext$.pipe(
    map(isBuildingBlock =>
      isBuildingBlock
        ? 'pluginManagement.labels.pluginName'
        : 'pluginManagement.labels.configurationName'
    )
  );

  public readonly selectedPluginConfiguration$ = this._pluginStateService.selectedPluginConfiguration$;
  public readonly selectedPluginDefinition$ = this._pluginStateService.selectedPluginDefinition$;

  private readonly _subscriptions = new Subscription();
  private _pluginDefinitionsCache: PluginDefinition[] = [];

  constructor(
    private readonly _pluginManagementService: PluginManagementService,
    private readonly _pluginStateService: PluginStateService,
    private readonly _pluginService: PluginService,
    private readonly _stateService: ProcessLinkStateService,
    private readonly _buttonService: ProcessLinkButtonService,
    private readonly _stepService: ProcessLinkStepService,
    private readonly _pluginTranslationService: PluginTranslationService,
    private readonly _externalPluginService: ExternalPluginService,
    private readonly _translateService: TranslateService
  ) {}

  public ngOnInit(): void {
    this._openBackButtonSubscription();
    this._openNextButtonSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public selected(event: {value: PluginConfiguration | string}): void {
    this.isBuildingBlockContext$.pipe(take(1)).subscribe(isBuildingBlock => {
      if (isBuildingBlock) {
        const definitionKey = event.value as string;
        const definition = this._pluginDefinitionsCache.find(def => def.key === definitionKey);
        this._selectDefinition(definition);
      } else {
        this._selectConfiguration(event.value as PluginConfiguration);
      }
      this._buttonService.enableNextButton();
    });
  }

  private _selectConfiguration(configuration: PluginConfiguration): void {
    if (!configuration) return;
    if (configuration.pluginDefinition) {
      this._pluginStateService.selectPluginDefinition(configuration.pluginDefinition);
    }
    this._pluginStateService.selectPluginConfiguration(configuration);
  }

  private _selectDefinition(definition: PluginDefinition | undefined): void {
    if (!definition) return;
    this._pluginStateService.selectPluginDefinition(definition);
    this._pluginStateService.selectPluginConfiguration(undefined);
  }

  private _openBackButtonSubscription(): void {
    this._subscriptions.add(
      this._buttonService.backButtonClick$
        .pipe(
          withLatestFrom(this._stateService.isEditing$),
          filter(([, isEditing]) => !isEditing)
        )
        .subscribe(() => {
          this._stateService.setInitial();
        })
    );
  }

  private _openNextButtonSubscription(): void {
    this._subscriptions.add(
      this._buttonService.nextButtonClick$
        .pipe(
          withLatestFrom(this._stateService.isEditing$),
          filter(([, isEditing]) => !isEditing)
        )
        .subscribe(() => {
          this._stepService.setChoosePluginActionSteps();
        })
    );
  }
}
