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

import {Inject, Injectable, OnDestroy} from '@angular/core';
import {TabImpl, TabLoaderImpl} from '../models';
import {DEFAULT_TAB_COMPONENTS, DEFAULT_TABS, TAB_MAP} from '../constants';
import {ConfigService} from '@valtimo/config';
import {ActivatedRoute, Event as NavigationEvent, NavigationEnd, Router} from '@angular/router';
import {DossierDetailTabObjectTypeComponent} from '../components/dossier-detail/tab/object-type/object-type.component';
import {DossierTabApiService} from './dossier-tab-api.service';
import {BehaviorSubject, filter, map, Observable, Subscription} from 'rxjs';

@Injectable()
export class DossierTabService implements OnDestroy {
  private readonly _tabManagementEnabled!: boolean;
  private readonly _documentDefinitionName$: Observable<string> = this.route.params.pipe(
    map(params => params?.documentDefinitionName),
    filter(documentDefinitionName => !!documentDefinitionName)
  );
  private readonly _tabs$ = new BehaviorSubject<Array<TabImpl> | null>(null);
  private readonly _subscriptions = new Subscription();

  public get tabs$(): Observable<Array<TabImpl>> {
    return this._tabs$.pipe(filter(tabs => !!tabs));
  }

  constructor(
    @Inject(TAB_MAP) private readonly tabMap: Map<string, object> = DEFAULT_TABS,
    private readonly configService: ConfigService,
    private readonly route: ActivatedRoute,
    private readonly dossierTabApiService: DossierTabApiService
  ) {
    this._tabManagementEnabled = this.configService.config?.featureToggles?.enableTabManagement;
    this.openDocumentDefinitionNameSubscription();
  }

  public ngOnDestroy() {
    this._subscriptions.unsubscribe();
  }

  private getConfigurableTabs(documentDefinitionName: string): Map<string, object> {
    const tabMap = new Map<string, object>();

    if (this.configService?.config?.caseObjectTypes) {
      const allNamesObjects = this.configService?.config?.caseObjectTypes[documentDefinitionName];

      allNamesObjects?.forEach(name => {
        tabMap.set(name, DossierDetailTabObjectTypeComponent);
      });
    }

    return tabMap;
  }

  private getAllEnvironmentTabs(extraTabs: Map<string, object>): Array<TabImpl> {
    let i = 0;
    const tabMap = extraTabs
      ? new Map([...Array.from(this.tabMap.entries()), ...Array.from(extraTabs.entries())])
      : this.tabMap;
    const tabs: Array<TabImpl> = [];

    tabMap.forEach((component, name) => {
      tabs.push(new TabImpl(name, i, component));
      i++;
    });

    return tabs;
  }

  private openDocumentDefinitionNameSubscription(): void {
    this._subscriptions.add(
      this._documentDefinitionName$.subscribe(documentDefinitionName => {
        if (this._tabManagementEnabled) {
          this.setApiTabs(documentDefinitionName);
        } else {
          this.setEnvironmentTabs(documentDefinitionName);
        }
      })
    );
  }

  private setApiTabs(documentDefinitionName: string): void {
    this.dossierTabApiService.getDossierTabs(documentDefinitionName).subscribe({
      next: tabs => {
        const supportedTabs = tabs.filter(tab => !!DEFAULT_TAB_COMPONENTS[tab.contentKey]);
        const mappedTabs = supportedTabs.map(
          (tab, index) => new TabImpl(tab.contentKey, index, DEFAULT_TAB_COMPONENTS[tab.contentKey])
        );
        this._tabs$.next(mappedTabs);
      },
      error: () => {
        this._tabs$.next([]);
      },
    });
  }

  private setEnvironmentTabs(documentDefinitionName: string): void {
    const configurableTabs = this.getConfigurableTabs(documentDefinitionName);
    const allEnvironmentTabs = this.getAllEnvironmentTabs(configurableTabs);
    this._tabs$.next(allEnvironmentTabs);
  }
}
