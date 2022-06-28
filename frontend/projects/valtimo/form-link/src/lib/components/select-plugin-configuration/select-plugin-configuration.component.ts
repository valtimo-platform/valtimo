/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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
import {map, switchMap, take, tap} from 'rxjs/operators';
import {
  PluginDefinition,
  PluginConfiguration,
  PluginManagementService,
  PluginConfigurationWithLogo,
} from '@valtimo/plugin-management';
import {ProcessLinkStateService} from '../../services/process-link-state.service';
import {combineLatest, Observable, of} from 'rxjs';
import {PluginService} from '@valtimo/plugin';

@Component({
  selector: 'valtimo-select-plugin-configuration',
  templateUrl: './select-plugin-configuration.component.html',
  styleUrls: ['./select-plugin-configuration.component.scss'],
})
export class SelectPluginConfigurationComponent {
  readonly pluginConfigurations$: Observable<Array<PluginConfigurationWithLogo>> = combineLatest([
    this.pluginManagementService.getAllPluginConfigurationsWithLogos(),
    this.pluginService.availablePluginIds$,
  ]).pipe(
    map(([pluginConfigurations, availablePluginIds]) =>
      pluginConfigurations.filter(configuration =>
        availablePluginIds.includes(configuration.definitionKey)
      )
    )
  );

  readonly selectedPluginConfiguration$ = this.processLinkStateService.selectedPluginConfiguration$;

  constructor(
    private readonly pluginManagementService: PluginManagementService,
    private readonly processLinkStateService: ProcessLinkStateService,
    private readonly pluginService: PluginService
  ) {}

  selectConfiguration(configuration: PluginConfiguration): void {
    this.processLinkStateService.selectPluginDefinition({key: configuration.definitionKey});
    this.processLinkStateService.selectPluginConfiguration(configuration);
  }

  deselectConfiguration(): void {
    this.processLinkStateService.deselectPluginDefinition();
    this.processLinkStateService.deselectPluginConfiguration();
  }
}
