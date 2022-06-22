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

import {Component, EventEmitter, Output} from '@angular/core';
import {ProcessLinkStateService} from '../../services';
import {combineLatest} from 'rxjs';
import {map} from 'rxjs/operators';

@Component({
  selector: 'valtimo-plugin-function-configuration',
  templateUrl: './plugin-function-configuration.component.html',
  styleUrls: ['./plugin-function-configuration.component.scss'],
})
export class PluginFunctionConfigurationComponent {
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();

  readonly pluginDefinitionKey$ = this.stateService.selectedPluginConfiguration$.pipe(
    map(configuration => configuration?.definitionKey)
  );
  readonly functionKey$ = this.stateService.selectedPluginFunction$.pipe(
    map(pluginFunction => pluginFunction?.key)
  );

  constructor(private readonly stateService: ProcessLinkStateService) {}

  onValid(valid: boolean): void {
    this.valid.emit(valid);
  }
}
