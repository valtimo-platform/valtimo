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
import {
  PluginDefinition,
  PluginConfiguration,
  PluginFunction,
  PluginManagementService,
} from '@valtimo/plugin-management';
import {ProcessLinkStateService} from '../../services/process-link-state.service';
import {Observable, of} from 'rxjs';

@Component({
  selector: 'valtimo-select-plugin-function',
  templateUrl: './select-plugin-function.component.html',
  styleUrls: ['./select-plugin-function.component.scss'],
})
export class SelectPluginFunctionComponent {
  readonly pluginFunctions$: Observable<Array<PluginFunction> | undefined> =
    this.processLinkStateService.selectedPluginDefinition$.pipe(
      switchMap(selectedDefinition =>
        selectedDefinition
          ? this.pluginManagementService.getPluginFunctions(selectedDefinition.key)
          : of(undefined)
      )
    );
  readonly selectedPluginDefinition$ = this.processLinkStateService.selectedPluginDefinition$;
  readonly selectedPluginFunction$ = this.processLinkStateService.selectedPluginFunction$;

  constructor(
    private readonly pluginManagementService: PluginManagementService,
    private readonly processLinkStateService: ProcessLinkStateService
  ) {}

  selectFunction(pluginFunction: PluginFunction): void {
    this.processLinkStateService.selectPluginFunction(pluginFunction);
  }

  deselectFunction(): void {
    this.processLinkStateService.deselectPluginFunction();
  }
}
