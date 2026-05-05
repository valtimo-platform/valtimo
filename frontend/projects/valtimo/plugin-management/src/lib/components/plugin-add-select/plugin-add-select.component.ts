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

import {Component, OnDestroy, OnInit} from '@angular/core';
import {BehaviorSubject, combineLatest, Observable, of, Subscription} from 'rxjs';
import {catchError, map} from 'rxjs/operators';
import {ExternalPluginService, PluginManagementStateService} from '../../services';
import {ExternalPluginDefinition} from '../../models';
import {
  PluginDefinition,
  PluginDefinitionWithLogo,
  PluginManagementService,
  PLUGIN_CATALOG_TEST_IDS,
} from '@valtimo/plugin';

export interface UnifiedPluginDefinition extends PluginDefinitionWithLogo {
  external?: boolean;
  externalName?: string | null;
  externalDescription?: string | null;
}

@Component({
  standalone: false,
  selector: 'valtimo-plugin-add-select',
  templateUrl: './plugin-add-select.component.html',
  styleUrls: ['./plugin-add-select.component.scss'],
})
export class PluginAddSelectComponent implements OnInit, OnDestroy {
  public readonly selectedPluginDefinition$ = this.stateService.selectedPluginDefinition$;
  public readonly disabled$ = this.stateService.inputDisabled$;
  public readonly testIds = PLUGIN_CATALOG_TEST_IDS;

  private readonly _externalDefs$ = new BehaviorSubject<ExternalPluginDefinition[]>([]);

  public readonly allDefinitions$: Observable<UnifiedPluginDefinition[] | undefined> =
    combineLatest([
      this.stateService.pluginDefinitionsWithLogos$,
      this._externalDefs$.asObservable(),
    ]).pipe(
      map(([embedded, external]) => {
        if (!embedded) return undefined;

        const externalDefs: UnifiedPluginDefinition[] = external.map(def => ({
          key: `external:${def.id}`,
          title: def.name ?? def.pluginId,
          description: def.description,
          external: true,
          externalName: def.name ?? def.pluginId,
          externalDescription: def.description,
        }));

        return [
          ...embedded.map(d => ({...d, external: false} as UnifiedPluginDefinition)),
          ...externalDefs,
        ];
      })
    );

  private refreshSubscription!: Subscription;

  constructor(
    private readonly pluginManagementService: PluginManagementService,
    private readonly stateService: PluginManagementStateService,
    private readonly externalPluginService: ExternalPluginService
  ) {}

  public ngOnInit(): void {
    this.openRefreshSubscription();
    this.getPluginDefinitions();
    this.getExternalPluginDefinitions();
  }

  public ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
  }

  public selectPluginDefinition(event: {value: PluginDefinition}): void {
    this.stateService.selectPluginDefinition(event.value);
  }

  public deselectPluginDefinition(): void {
    this.stateService.clearSelectedPluginDefinition();
  }

  private getPluginDefinitions(): void {
    this.pluginManagementService.getPluginDefinitions().subscribe(pluginDefinitions => {
      this.stateService.setPluginDefinitions(pluginDefinitions);
    });
  }

  private getExternalPluginDefinitions(): void {
    this.externalPluginService
      .getDefinitions()
      .pipe(catchError(() => of([] as ExternalPluginDefinition[])))
      .subscribe(definitions => {
        this._externalDefs$.next(definitions);
      });
  }

  private openRefreshSubscription(): void {
    this.refreshSubscription = combineLatest([
      this.stateService.showModal$,
      this.stateService.refresh$,
    ]).subscribe(() => {
      this.stateService.clearSelectedPluginDefinition();
    });
  }
}
