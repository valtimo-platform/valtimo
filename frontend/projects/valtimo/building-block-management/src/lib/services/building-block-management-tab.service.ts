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
import {Inject, Injectable, Optional} from '@angular/core';
import {
  BUILDING_BLOCK_MANAGEMENT_TAB_TOKEN,
  BuildingBlockManagementTabConfig,
} from '@valtimo/shared';
import {BehaviorSubject, Observable, of} from 'rxjs';

/**
 * Holds the custom building-block-management tabs as a reactive stream so tabs
 * contributed after bootstrap (e.g. by a plugin loaded as a Native Federation
 * remote) show up on the detail page. The detail component reads this stream
 * instead of injecting BUILDING_BLOCK_MANAGEMENT_TAB_TOKEN directly, because the
 * token is resolved once at injector creation and cannot pick up late additions.
 * Statically-provided tabs are seeded from the token in the constructor.
 */
@Injectable({providedIn: 'root'})
export class BuildingBlockManagementTabService {
  private readonly _customTabs$ = new BehaviorSubject<BuildingBlockManagementTabConfig[]>([]);

  public get customTabs$(): Observable<BuildingBlockManagementTabConfig[]> {
    return this._customTabs$.asObservable();
  }

  constructor(
    @Optional()
    @Inject(BUILDING_BLOCK_MANAGEMENT_TAB_TOKEN)
    private readonly injectedTabs: BuildingBlockManagementTabConfig[]
  ) {
    this.registerBuildingBlockTabs(this.injectedTabs);
  }

  /**
   * Register building-block-management tabs after bootstrap. Idempotent by tab
   * route, so loading the same remote twice does not create duplicates.
   */
  public registerBuildingBlockTabs(
    tabConfig?: BuildingBlockManagementTabConfig[] | BuildingBlockManagementTabConfig
  ): void {
    if (!tabConfig) return;
    const incoming = Array.isArray(tabConfig) ? tabConfig : [tabConfig];

    const current = this._customTabs$.getValue();
    const knownRoutes = new Set(current.map(tab => tab.tabRoute));
    const additions = incoming
      .filter(tab => !knownRoutes.has(tab.tabRoute))
      .map(tab => ({...tab, enabled$: tab.enabled$ ?? of(true)}));

    if (additions.length > 0) {
      this._customTabs$.next([...current, ...additions]);
    }
  }
}
