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
import {take, tap} from 'rxjs/operators';
import {PluginDefinition, PluginService} from '@valtimo/plugin-management';
import {ProcessLinkStateService} from '../../services/process-link-state.service';

@Component({
  selector: 'valtimo-select-plugin',
  templateUrl: './select-plugin.component.html',
  styleUrls: ['./select-plugin.component.scss'],
})
export class SelectPluginComponent {
  readonly pluginDefinitions$ = this.pluginService.getPluginDefinitions();
  readonly selectedPluginDefinition$ = this.processLinkStateService.selectedPluginDefinition$;

  constructor(
    private readonly pluginService: PluginService,
    private readonly processLinkStateService: ProcessLinkStateService
  ) {}

  selectPlugin(pluginDefinition: PluginDefinition): void {
    this.processLinkStateService.selectPluginDefinition(pluginDefinition);
  }

  deselectPlugin(): void {
    this.processLinkStateService.deselectPluginDefinition();
  }
}
