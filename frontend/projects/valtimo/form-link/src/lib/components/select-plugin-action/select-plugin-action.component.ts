/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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
import {switchMap, take} from 'rxjs/operators';
import {PluginFunction, PluginManagementService} from '@valtimo/plugin';
import {PluginStateService} from '../../services/plugin-state.service';
import {Observable, of, Subscription} from 'rxjs';
import {ProcessLinkButtonService, ProcessLinkStepService} from '../../services';

@Component({
  selector: 'valtimo-select-plugin-action',
  templateUrl: './select-plugin-action.component.html',
  styleUrls: ['./select-plugin-action.component.scss'],
})
export class SelectPluginActionComponent implements OnInit, OnDestroy {
  readonly pluginFunctions$: Observable<Array<PluginFunction> | undefined> =
    this.stateService.selectedPluginDefinition$.pipe(
      switchMap(selectedDefinition =>
        selectedDefinition
          ? this.pluginManagementService.getPluginFunctions(selectedDefinition.key)
          : of(undefined)
      )
    );
  readonly selectedPluginDefinition$ = this.stateService.selectedPluginDefinition$;
  readonly selectedPluginFunction$ = this.stateService.selectedPluginFunction$;

  private _subscriptions = new Subscription();

  constructor(
    private readonly pluginManagementService: PluginManagementService,
    private readonly stateService: PluginStateService,
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

  selectFunction(pluginFunction: PluginFunction): void {
    this.stateService.selectPluginFunction(pluginFunction);
  }

  selected(event: {value: string}): void {
    this.selectFunction(JSON.parse(event.value));
    this.buttonService.enableNextButton();
  }

  stringify(object: object): string {
    return JSON.stringify(object);
  }

  private openBackButtonSubscription(): void {
    this._subscriptions.add(
      this.buttonService.backButtonClick$.subscribe(() => {
        this.stepService.hasOneProcessLinkType$.pipe(take(1)).subscribe(hasOneOption => {
          this.stepService.setProcessLinkTypeSteps('plugin', hasOneOption);
        });
      })
    );
  }

  private openNextButtonSubscription(): void {
    this._subscriptions.add(
      this.buttonService.nextButtonClick$.subscribe(() => {
        this.stepService.setConfigurePluginActionSteps();
      })
    );
  }
}
