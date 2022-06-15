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

import {Component, ViewChild, ViewContainerRef} from '@angular/core';
import {ProcessLinkStateService} from '../../services';
import {BehaviorSubject, combineLatest} from 'rxjs';
import {take, tap} from 'rxjs/operators';

@Component({
  selector: 'valtimo-plugin-function-configuration',
  templateUrl: './plugin-function-configuration.component.html',
  styleUrls: ['./plugin-function-configuration.component.scss'],
})
export class PluginFunctionConfigurationComponent {
  @ViewChild('functionConfigurationComponent', {static: true, read: ViewContainerRef})
  public dynamicContainer: ViewContainerRef;

  readonly noConfigurationComponentAvailable$ = new BehaviorSubject<boolean>(false);

  selectedPluginFunction$ = combineLatest([
    this.stateService.selectedPluginSpecification$,
    this.stateService.selectedPluginFunction$,
  ]).pipe(
    tap(([selectedPluginSpecification, pluginFunction]) => {
      const selectedPluginFunctionId = pluginFunction?.key;
      const selectedPluginFunctionConfigurationComponent =
        selectedPluginSpecification?.functionConfigurationComponents[selectedPluginFunctionId];

      this.dynamicContainer.clear();

      if (selectedPluginSpecification && selectedPluginFunctionConfigurationComponent) {
        const componentInstance = this.dynamicContainer.createComponent(
          selectedPluginFunctionConfigurationComponent
        );
        this.noConfigurationComponentAvailable$.next(false);
      } else {
        this.noConfigurationComponentAvailable$.next(true);
      }
    })
  );

  constructor(private readonly stateService: ProcessLinkStateService) {}
}
