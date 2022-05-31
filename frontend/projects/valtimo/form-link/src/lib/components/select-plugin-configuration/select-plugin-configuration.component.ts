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
import {switchMap, take, tap} from 'rxjs/operators';
import {PluginDefinition, PluginConfiguration, PluginService} from '@valtimo/plugin-management';
import {ProcessLinkStateService} from '../../services/process-link-state.service';
import {Observable, of} from 'rxjs';

@Component({
  selector: 'valtimo-select-plugin-configuration',
  templateUrl: './select-plugin-configuration.component.html',
  styleUrls: ['./select-plugin-configuration.component.scss'],
})
export class SelectPluginConfigurationComponent {
  readonly pluginConfigurations$: Observable<Array<PluginConfiguration> | undefined> =
    this.processLinkStateService.selectedPluginDefinition$.pipe(
      switchMap(selectedDefinition =>
        selectedDefinition
          ? this.pluginService.getPluginConfigurations(selectedDefinition.key)
          : of(undefined)
      )
    );
  readonly selectedPluginConfiguration$ = this.processLinkStateService.selectedPluginConfiguration$;

  constructor(
    private readonly pluginService: PluginService,
    private readonly processLinkStateService: ProcessLinkStateService
  ) {}

  selectConfiguration(configuration: PluginConfiguration): void {
    this.processLinkStateService.selectPluginConfiguration(configuration);
  }

  deselectConfiguration(): void {
    this.processLinkStateService.deselectPluginConfiguration();
  }
}
