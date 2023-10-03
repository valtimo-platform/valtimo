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

import {Inject, Injectable} from '@angular/core';
import {TabImpl} from '../models';
import {DEFAULT_TABS, TAB_MAP} from '../constants';
import {ConfigService} from '@valtimo/config';
import {ActivatedRoute, Event as NavigationEvent, NavigationEnd, Router} from '@angular/router';
import {DossierDetailTabObjectTypeComponent} from '../components/dossier-detail/tab/object-type/object-type.component';

@Injectable({
  providedIn: 'root',
})
export class DossierTabService {
  private readonly tabMap: Map<string, object>;
  private tabs: TabImpl[] = [];
  private allTabs!: Map<string, object>;
  private extraTabs!: Map<string, object>;
  private readonly tabManagementEnabled!: boolean;

  constructor(
    @Inject(TAB_MAP) tabMap: Map<string, object> = DEFAULT_TABS,
    private readonly configService: ConfigService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.tabManagementEnabled = this.configService.config?.featureToggles?.enableTabManagement;
    this.tabMap = tabMap;
    this.setTabs();
    this.openRouterSubscription();
  }

  public getTabs(): TabImpl[] {
    return this.tabs;
  }

  public getConfigurableTabs(documentDefinitionName: string) {
    if (this.configService?.config?.caseObjectTypes && this.tabManagementEnabled) {
      const allNamesObjects = this.configService?.config?.caseObjectTypes[documentDefinitionName];
      const map = new Map();

      allNamesObjects?.forEach(name => {
        map.set(name, DossierDetailTabObjectTypeComponent);
      });

      this.extraTabs = map;
    } else {
      this.extraTabs = new Map<string, object>();
    }
  }

  private setTabs(extraTabs?: Map<string, object>) {
    if (this.tabManagementEnabled) {
      this.setApiTabs();
    } else {
      this.setEnvironmentTabs(extraTabs);
    }
  }

  private setEnvironmentTabs(extraTabs?: Map<string, object>): void {
    let i = 0;

    this.tabs = [];

    this.allTabs = extraTabs
      ? new Map([...Array.from(this.tabMap.entries()), ...Array.from(extraTabs.entries())])
      : this.tabMap;

    this.allTabs.forEach((component, name) => {
      this.tabs.push(new TabImpl(name, i, component));
      i++;
    });
  }

  private setApiTabs(): void {
    // to implement
  }

  private openRouterSubscription(): void {
    this.router.events.subscribe((event: NavigationEvent) => {
      if (event instanceof NavigationEnd) {
        this.setTabs(this.extraTabs);
      }
    });
  }
}
