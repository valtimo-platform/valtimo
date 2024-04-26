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

import {Inject, Injectable, OnDestroy, Optional, Type} from '@angular/core';
import {ApiTabItem, ApiTabType, CaseTabConfig, TabImpl} from '../models';
import {CASE_TAB_TOKEN, DEFAULT_TAB_COMPONENTS, DEFAULT_TABS, TAB_MAP} from '../constants';
import {ConfigService, ZGW_OBJECT_TYPE_COMPONENT_TOKEN} from '@valtimo/config';
import {ActivatedRoute} from '@angular/router';
import {DossierTabApiService} from './dossier-tab-api.service';
import {BehaviorSubject, filter, map, Observable, Subscription} from 'rxjs';
import {DossierDetailTabFormioComponent} from '../components/dossier-detail/tab/formio/formio.component';
import {DossierDetailTabNotFoundComponent} from '../components/dossier-detail/tab/not-found/not-found.component';

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
    @Optional() @Inject(CASE_TAB_TOKEN) private readonly caseTabConfig: CaseTabConfig,
    @Optional()
    @Inject(ZGW_OBJECT_TYPE_COMPONENT_TOKEN)
    private readonly zgwObjectTypeComponent: Type<any>,
    private readonly configService: ConfigService,
    private readonly route: ActivatedRoute,
    private readonly dossierTabApiService: DossierTabApiService
  ) {
    this._tabManagementEnabled =
      this.configService.config.featureToggles?.enableTabManagement ?? true;
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
        tabMap.set(name, this.zgwObjectTypeComponent || DossierDetailTabNotFoundComponent);
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

  private setEnvironmentTabs(documentDefinitionName: string): void {
    const configurableTabs = this.getConfigurableTabs(documentDefinitionName);
    const allEnvironmentTabs = this.getAllEnvironmentTabs(configurableTabs);
    this._tabs$.next(allEnvironmentTabs);
  }

  private setApiTabs(documentDefinitionName: string): void {
    this.dossierTabApiService.getDossierTabs(documentDefinitionName).subscribe({
      next: tabs => {
        const supportedTabs = tabs.filter(tab => this.filterTab(tab));
        const mappedTabs = supportedTabs.map((tab, index) => this.mapTab(tab, index));
        this._tabs$.next(mappedTabs.filter(tab => !!tab));
      },
      error: () => {
        this._tabs$.next([]);
      },
    });
  }

  private filterTab(tab: ApiTabItem): boolean {
    switch (tab.type) {
      case ApiTabType.STANDARD:
        return !!DEFAULT_TAB_COMPONENTS[tab.contentKey];
      case ApiTabType.CUSTOM:
        return !!(this.caseTabConfig || {})[tab.contentKey];
      default:
        return true;
    }
  }

  private mapTab(tab: ApiTabItem, index: number): TabImpl | null {
    switch (tab.type) {
      case ApiTabType.STANDARD:
        return new TabImpl(
          tab.key,
          index,
          DEFAULT_TAB_COMPONENTS[tab.contentKey],
          tab.contentKey,
          tab.name
        );
      case ApiTabType.FORMIO:
        return new TabImpl(
          tab.key,
          index,
          DossierDetailTabFormioComponent,
          tab.contentKey,
          tab.name
        );
      case ApiTabType.CUSTOM:
        return new TabImpl(
          tab.key,
          index,
          this.caseTabConfig[tab.contentKey],
          tab.contentKey,
          tab.name
        );
      default:
        return null;
    }
  }
}
