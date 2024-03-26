/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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
import {map, switchMap} from 'rxjs/operators';
import {PluginStateService} from '../../services/plugin-state.service';
import {combineLatest, Observable, of, Subscription} from 'rxjs';
import {
  PluginConfiguration,
  PluginConfigurationWithLogo,
  PluginManagementService,
  PluginService,
} from '@valtimo/plugin';
import {
  ProcessLinkButtonService,
  ProcessLinkStateService,
  ProcessLinkStepService,
} from '../../services';

@Component({
  selector: 'valtimo-select-plugin-configuration',
  templateUrl: './select-plugin-configuration.component.html',
  styleUrls: ['./select-plugin-configuration.component.scss'],
})
export class SelectPluginConfigurationComponent implements OnInit, OnDestroy {
  readonly pluginConfigurations$: Observable<Array<PluginConfigurationWithLogo>> =
    this.stateService.modalParams$.pipe(
      switchMap(modalData =>
        combineLatest([
          modalData?.element?.type
            ? this.pluginManagementService.getAllPluginConfigurationsWithLogos(
                modalData?.element?.activityListenerType
              )
            : of(undefined),
          this.pluginService.availablePluginIds$,
        ]).pipe(
          map(([pluginConfigurations, availablePluginIds]) =>
            pluginConfigurations?.filter(configuration =>
              availablePluginIds.includes(configuration.pluginDefinition.key)
            )
          )
        )
      )
    );

  readonly selectedPluginConfiguration$ = this.pluginStateService.selectedPluginConfiguration$;

  private _subscriptions = new Subscription();

  constructor(
    private readonly pluginManagementService: PluginManagementService,
    private readonly pluginStateService: PluginStateService,
    private readonly pluginService: PluginService,
    private readonly stateService: ProcessLinkStateService,
    private readonly buttonService: ProcessLinkButtonService,
    private readonly stepService: ProcessLinkStepService
  ) {}

  ngOnInit(): void {
    this.openBackButtonSubscription();
    this.openNextButtonSubscription();
  }

  ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  selected(event: {value: PluginConfiguration}): void {
    this.selectConfiguration(event.value);
    this.buttonService.enableNextButton();
  }

  private selectConfiguration(configuration: PluginConfiguration): void {
    this.pluginStateService.selectPluginDefinition({key: configuration.pluginDefinition.key});
    this.pluginStateService.selectPluginConfiguration(configuration);
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
