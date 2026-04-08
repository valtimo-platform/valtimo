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
import {Component, Injector, OnDestroy, OnInit} from '@angular/core';
import {PluginDefinition, PluginFunction, PluginManagementService, PluginService} from '@valtimo/plugin';
import {combineLatest, forkJoin, Observable, of, Subscription} from 'rxjs';
import {filter, map, switchMap, take, withLatestFrom} from 'rxjs/operators';

import {
  PluginStateService,
  ProcessLinkButtonService,
  ProcessLinkStateService,
  ProcessLinkStepService,
} from '../../services';

@Component({
  standalone: false,
  selector: 'valtimo-select-plugin-action',
  templateUrl: './select-plugin-action.component.html',
  styleUrls: ['./select-plugin-action.component.scss'],
})
export class SelectPluginActionComponent implements OnInit, OnDestroy {
  public readonly pluginFunctions$: Observable<Array<PluginFunction> | undefined> = combineLatest([
    this.stateService.selectedPluginDefinition$,
    this.processLinkStateService.modalParams$,
    this.stateService.selectedPluginConfiguration$,
    this.pluginService.pluginSpecifications$,
  ]).pipe(
    switchMap(([selectedDefinition, modalParams, selectedConfiguration, pluginSpecifications]) => {
      if (!selectedDefinition) return of(undefined);

      return this.pluginManagementService
        .getPluginFunctions(selectedDefinition.key, modalParams.element.activityListenerType)
        .pipe(
          switchMap(functions => {
            const specification = pluginSpecifications.find(
              s => s.pluginId === selectedDefinition.key
            );
            if (!specification?.functionConfigurationComponentsFilter) return of(functions);

            const props = (selectedConfiguration?.properties ?? {}) as {[key: string]: any};
            const filterFn = specification.functionConfigurationComponentsFilter;

            return forkJoin(
              functions.map(fn =>
                filterFn(props, fn.key, this.injector).pipe(map(visible => ({fn, visible})))
              )
            ).pipe(map(results => results.filter(r => r.visible).map(r => r.fn)));
          })
        );
    })
  );
  public readonly selectedPluginDefinition$: Observable<PluginDefinition> =
    this.stateService.selectedPluginDefinition$;
  public readonly selectedPluginFunction$: Observable<PluginFunction> =
    this.stateService.selectedPluginFunction$;

  private _subscriptions = new Subscription();

  constructor(
    private readonly buttonService: ProcessLinkButtonService,
    private readonly injector: Injector,
    private readonly pluginManagementService: PluginManagementService,
    private readonly pluginService: PluginService,
    private readonly stateService: PluginStateService,
    private readonly stepService: ProcessLinkStepService,
    private readonly processLinkStateService: ProcessLinkStateService
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
        withLatestFrom(this.processLinkStateService.isEditing$),
        filter(([, isEditing]) => !isEditing),
        switchMap(() => this.stepService.hasOneProcessLinkType$),
        take(1)
      )
      .subscribe((hasOneOption: boolean) => {
        this.stepService.setProcessLinkTypeSteps('plugin', hasOneOption);
      });
  }

  private openNextButtonSubscription(): void {
    this._subscriptions.add(
      this.buttonService.nextButtonClick$
        .pipe(
          withLatestFrom(this.processLinkStateService.isEditing$),
          filter(([, isEditing]) => !isEditing)
        )
        .subscribe(() => {
          this.stepService.setConfigurePluginActionSteps();
        })
    );
  }
}
