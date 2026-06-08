/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {BehaviorSubject, combineLatest, Observable, Subscription} from 'rxjs';
import {map} from 'rxjs/operators';
import {PluginManagementStateService} from '../../services';
import {UnifiedPluginDefinition} from '../../models';
import {
  ExternalPluginDefinition,
  PluginDefinition,
  PluginManagementService,
  toExternalPluginKey,
  PLUGIN_CATALOG_TEST_IDS,
} from '@valtimo/plugin';

@Component({
  standalone: false,
  selector: 'valtimo-plugin-add-select',
  templateUrl: './plugin-add-select.component.html',
  styleUrls: ['./plugin-add-select.component.scss'],
})
export class PluginAddSelectComponent implements OnInit, OnDestroy {
  @Input() set externalDefinitions(value: ExternalPluginDefinition[] | null) {
    this._externalDefs$.next(value ?? []);
  }

  public readonly selectedPluginDefinition$ = this._stateService.selectedPluginDefinition$;
  public readonly disabled$ = this._stateService.inputDisabled$;
  public readonly testIds = PLUGIN_CATALOG_TEST_IDS;

  private readonly _externalDefs$ = new BehaviorSubject<ExternalPluginDefinition[]>([]);

  public readonly allDefinitions$: Observable<UnifiedPluginDefinition[] | undefined> =
    combineLatest([
      this._stateService.pluginDefinitionsWithLogos$,
      this._externalDefs$,
    ]).pipe(
      map(([embedded, external]) => {
        if (!embedded) return undefined;

        const externalDefs: UnifiedPluginDefinition[] = external.map(def => ({
          key: toExternalPluginKey(def.id),
          title: def.name ?? def.pluginId,
          description: def.description,
          source: 'external',
          externalDefinitionId: def.id,
          externalName: def.name ?? def.pluginId,
          externalDescription: def.description,
        }));

        return [
          ...embedded.map(d => ({...d, source: 'embedded'} as UnifiedPluginDefinition)),
          ...externalDefs,
        ];
      })
    );

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly _pluginManagementService: PluginManagementService,
    private readonly _stateService: PluginManagementStateService
  ) {}

  public ngOnInit(): void {
    this._openRefreshSubscription();
    this._getPluginDefinitions();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public selectPluginDefinition(event: {value: PluginDefinition}): void {
    this._stateService.selectPluginDefinition(event.value);
  }

  public deselectPluginDefinition(): void {
    this._stateService.clearSelectedPluginDefinition();
  }

  private _getPluginDefinitions(): void {
    this._pluginManagementService.getPluginDefinitions().subscribe(pluginDefinitions => {
      this._stateService.setPluginDefinitions(pluginDefinitions);
    });
  }

  private _openRefreshSubscription(): void {
    this._subscriptions.add(
      combineLatest([
        this._stateService.showModal$,
        this._stateService.refresh$,
      ]).subscribe(() => {
        this._stateService.clearSelectedPluginDefinition();
      })
    );
  }
}
