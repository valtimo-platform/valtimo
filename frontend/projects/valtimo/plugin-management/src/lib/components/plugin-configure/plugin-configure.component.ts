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

import {Component, EventEmitter, Input, Output} from '@angular/core';
import {map, switchMap} from 'rxjs/operators';
import {PluginManagementStateService} from '../../services';
import {PluginConfigurationData} from '@valtimo/plugin';
import {of} from 'rxjs';
import { TEST_IDS } from '@valtimo/shared';

@Component({
  standalone: false,
  selector: 'valtimo-plugin-configure',
  templateUrl: './plugin-configure.component.html',
  styleUrls: ['./plugin-configure.component.scss'],
})
export class PluginConfigureComponent {
  readonly TEST_IDS = TEST_IDS;

  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<PluginConfigurationData> =
    new EventEmitter<PluginConfigurationData>();

  public readonly save$ = this.stateService.save$;

  public readonly pluginDefinitionKey$ = this.stateService.selectedPluginDefinition$.pipe(
    map(definition => definition?.key)
  );

  public readonly prefillConfiguration$ = of(undefined);

  public readonly disabled$ = this.stateService.inputDisabled$;

  constructor(private readonly stateService: PluginManagementStateService) {}

  public onValid(valid: boolean): void {
    this.valid.emit(valid);
  }

  public onFunctionConfiguration(configuration: PluginConfigurationData): void{
    this.configuration.emit(configuration);
  }
}
