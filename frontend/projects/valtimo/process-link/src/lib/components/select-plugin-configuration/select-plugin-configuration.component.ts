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
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Component, OnDestroy, OnInit} from '@angular/core';
import {map, switchMap, take} from 'rxjs/operators';
import {PluginStateService} from '../../services/plugin-state.service';
import {combineLatest, Observable, of, Subscription} from 'rxjs';
import {
  PluginConfiguration,
  PluginDefinition,
  PluginManagementService,
  PluginService,
  PluginTranslationService,
} from '@valtimo/plugin';
import {
  ProcessLinkButtonService,
  ProcessLinkStateService,
  ProcessLinkStepService,
} from '../../services';

type PluginDefinitionWithLogo = PluginDefinition & {pluginLogoBase64?: string};
type PluginListItem = {
  id: string;
  title: string;
  description: string;
  logo?: string | null;
  payload: PluginConfiguration | string;
  isDefinition: boolean;
};

@Component({
  standalone: false,
  selector: 'valtimo-select-plugin-configuration',
  templateUrl: './select-plugin-configuration.component.html',
  styleUrls: ['./select-plugin-configuration.component.scss'],
})
export class SelectPluginConfigurationComponent implements OnInit, OnDestroy {
  readonly isBuildingBlockContext$ = this.stateService.context$.pipe(
    map(context => context === 'buildingBlock')
  );

  readonly listItems$: Observable<PluginListItem[] | undefined> = combineLatest([
    this.isBuildingBlockContext$,
    this.stateService.modalParams$,
  ]).pipe(
    switchMap(([isBuildingBlock, modalData]) =>
      isBuildingBlock
        ? combineLatest([
            this.pluginManagementService.getPluginDefinitions(
              modalData?.element?.activityListenerType
            ),
            this.pluginService.pluginSpecifications$,
          ]).pipe(
            map(([definitions, specs]) => {
              const limitedDefinitions =
                definitions?.filter(definition =>
                  specs.some(spec => spec.pluginId === definition.key)
                ) ?? [];
              const enriched = limitedDefinitions.map(definition => {
                const spec = specs.find(item => item.pluginId === definition.key);
                return {
                  id: definition.key,
                  title:
                    this.pluginTranslationService.instant('title', definition.key) ||
                    definition.title,
                  description:
                    this.pluginTranslationService.instant('description', definition.key) ||
                    definition.description,
                  logo: spec?.pluginLogoBase64 ?? null,
                  payload: definition.key,
                  isDefinition: true,
                } as PluginListItem;
              });
              this.pluginDefinitionsCache = limitedDefinitions;
              return enriched;
            })
          )
        : combineLatest([
            modalData?.element?.type
              ? this.pluginManagementService.getAllPluginConfigurationsWithLogos(
                  modalData?.element?.activityListenerType
                )
              : of(undefined),
            this.pluginService.availablePluginIds$,
          ]).pipe(
            map(([configs, availablePluginIds]) =>
              configs
                ?.filter(configuration =>
                  availablePluginIds.includes(configuration.pluginDefinition.key)
                )
                ?.map(configuration => ({
                  id: configuration.id ?? configuration.title,
                  title: configuration.title,
                  description: this.pluginTranslationService.instant(
                    'description',
                    configuration.pluginDefinition.key
                  ),
                  logo: (configuration.pluginLogoBase64 as string) ?? null,
                  payload: configuration,
                  isDefinition: false,
                }))
            )
          )
    )
  );

  readonly pageHeaderText$ = this.isBuildingBlockContext$.pipe(
    map(isBuildingBlock =>
      isBuildingBlock
        ? 'processLinkConfiguration.choosePluginDefinitionDescription'
        : 'processLinkConfiguration.choosePluginConfigurationDescription'
    )
  );

  readonly columnHeaderText$ = this.isBuildingBlockContext$.pipe(
    map(isBuildingBlock =>
      isBuildingBlock
        ? 'pluginManagement.labels.pluginName'
        : 'pluginManagement.labels.configurationName'
    )
  );

  readonly selectedPluginConfiguration$ = this.pluginStateService.selectedPluginConfiguration$;
  readonly selectedPluginDefinition$ = this.pluginStateService.selectedPluginDefinition$;

  private _subscriptions = new Subscription();
  private pluginDefinitionsCache: PluginDefinition[] = [];

  constructor(
    private readonly pluginManagementService: PluginManagementService,
    private readonly pluginStateService: PluginStateService,
    private readonly pluginService: PluginService,
    private readonly stateService: ProcessLinkStateService,
    private readonly buttonService: ProcessLinkButtonService,
    private readonly stepService: ProcessLinkStepService,
    private readonly pluginTranslationService: PluginTranslationService
  ) {}

  ngOnInit(): void {
    this.openBackButtonSubscription();
    this.openNextButtonSubscription();
  }

  ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  selected(event: {value: PluginConfiguration | string}): void {
    this.isBuildingBlockContext$.pipe(take(1)).subscribe(isBuildingBlock => {
      if (isBuildingBlock) {
        const definitionKey = event.value as string;
        const definition = this.pluginDefinitionsCache.find(def => def.key === definitionKey);
        this.selectDefinition(definition);
      } else {
        this.selectConfiguration(event.value as PluginConfiguration);
      }
      this.buttonService.enableNextButton();
    });
  }

  private selectConfiguration(configuration: PluginConfiguration): void {
    if (!configuration) return;
    if (configuration.pluginDefinition) {
      this.pluginStateService.selectPluginDefinition(configuration.pluginDefinition);
    }
    this.pluginStateService.selectPluginConfiguration(configuration);
  }

  private selectDefinition(definition: PluginDefinition | undefined): void {
    if (!definition) return;
    this.pluginStateService.selectPluginDefinition(definition);
    this.pluginStateService.selectPluginConfiguration(undefined);
  }

  private openBackButtonSubscription(): void {
    this._subscriptions.add(
      this.buttonService.backButtonClick$.subscribe(() => {
        this.stateService.setInitial();
      })
    );
  }

  private openNextButtonSubscription(): void {
    this._subscriptions.add(
      this.buttonService.nextButtonClick$.subscribe(() => {
        this.stepService.setChoosePluginActionSteps();
      })
    );
  }
}
