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
import {PluginDefinition, PluginFunction, PluginManagementService} from '@valtimo/plugin';
import {Observable, of, Subscription} from 'rxjs';
import {switchMap, take} from 'rxjs/operators';

import {ProcessLinkButtonService, ProcessLinkStepService} from '../../services';
import {PluginStateService} from '../../services/plugin-state.service';

@Component({
  selector: 'valtimo-select-plugin-action',
  templateUrl: './select-plugin-action.component.html',
  styleUrls: ['./select-plugin-action.component.scss'],
})
export class SelectPluginActionComponent implements OnInit, OnDestroy {
  public readonly pluginFunctions$: Observable<Array<PluginFunction> | undefined> =
    this.stateService.selectedPluginDefinition$.pipe(
      switchMap(selectedDefinition =>
        selectedDefinition
          ? this.pluginManagementService.getPluginFunctions(selectedDefinition.key)
          : of(undefined)
      )
    );
  public readonly selectedPluginDefinition$: Observable<PluginDefinition> =
    this.stateService.selectedPluginDefinition$;
  public readonly selectedPluginFunction$: Observable<PluginFunction> =
    this.stateService.selectedPluginFunction$;

  private _subscriptions = new Subscription();

  constructor(
    private readonly buttonService: ProcessLinkButtonService,
    private readonly pluginManagementService: PluginManagementService,
    private readonly stateService: PluginStateService,
    private readonly stepService: ProcessLinkStepService
  ) {}

  public ngOnInit(): void {
    this.openBackButtonSubscription();
    this.openNextButtonSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public selectFunction(pluginFunction: PluginFunction): void {
    this.stateService.selectPluginFunction(pluginFunction);
  }

  public selected(event: {value: string}): void {
    this.selectFunction(JSON.parse(event.value));
    this.buttonService.enableNextButton();
  }

  public stringify(object: object): string {
    return JSON.stringify(object);
  }

  private openBackButtonSubscription(): void {
    this.buttonService.backButtonClick$
      .pipe(
        switchMap(() => this.stepService.hasOneProcessLinkType$),
        take(1)
      )
      .subscribe((hasOneOption: boolean) => {
        this.stepService.setProcessLinkTypeSteps('plugin', hasOneOption);
      });
  }

  private openNextButtonSubscription(): void {
    this._subscriptions.add(
      this.buttonService.nextButtonClick$.subscribe(() => {
        this.stepService.setConfigurePluginActionSteps();
      })
    );
  }
}
