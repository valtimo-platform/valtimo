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

import {Inject, Injectable, OnDestroy, Optional, Signal, signal, Type} from '@angular/core';
import {
  ApiTabItem,
  ApiTabType,
  CaseTabConfig,
  DefaultTabs,
  TabImpl,
  TabLoaderImpl,
} from '../models';
import {CASE_TAB_TOKEN, DEFAULT_TAB_COMPONENTS, DEFAULT_TABS, TAB_MAP} from '../constants';
import {ConfigService, ZGW_OBJECT_TYPE_COMPONENT_TOKEN} from '@valtimo/shared';
import {ActivatedRoute} from '@angular/router';
import {CaseTabApiService} from './case-tab-api.service';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  map,
  Observable,
  Subscription,
  switchMap,
} from 'rxjs';
import {CaseDetailTabFormioComponent} from '../components/case-detail/tab/formio/formio.component';
import {CaseDetailTabNotFoundComponent} from '../components/case-detail/tab/not-found/not-found.component';
import {CaseDetailWidgetsComponent} from '../components/case-detail/tab/widgets/widgets.component';

@Injectable()
export class CaseTabService implements OnDestroy {
  private readonly _tabManagementEnabled!: boolean;
  private readonly _caseDefinitionKey$: Observable<string> = this.route.params.pipe(
    map(params => params?.caseDefinitionKey),
    filter(caseDefinitionKey => !!caseDefinitionKey)
  );
  private readonly _documentId$: Observable<string> = this.route.params.pipe(
    map(params => params?.documentId),
    filter(documentId => !!documentId)
  );
  private readonly _tabs$ = new BehaviorSubject<Array<TabImpl> | null>(null);
  private readonly _subscriptions = new Subscription();
  private readonly _tabLoader$ = new BehaviorSubject<TabLoaderImpl | null>(null);
  private readonly _tabHorizontalOverflowDisabled = signal(false);

  public get tabHorizontalOverflowDisabled(): Signal<boolean> {
    return this._tabHorizontalOverflowDisabled.asReadonly();
  }

  public get tabs$(): Observable<Array<TabImpl>> {
    return this._tabs$.pipe(filter(tabs => !!tabs));
  }

  public get activeTab$(): Observable<TabImpl> {
    return this._tabLoader$.pipe(
      filter(tabLoader => !!tabLoader),
      switchMap(tabLoader => tabLoader.activeTab$)
    );
  }

  public get activeTabKey$(): Observable<string> {
    return this.activeTab$.pipe(map(tab => tab.name));
  }

  public get showTaskList$(): Observable<boolean> {
    return this._tabLoader$.pipe(
      filter(tabLoader => !!tabLoader),
      switchMap(tabLoader => tabLoader.activeTab$),
      map(activeTab => !!activeTab?.showTasks || activeTab.contentKey === DefaultTabs.summary)
    );
  }

  constructor(
    @Inject(TAB_MAP) private readonly tabMap: Map<string, object> = DEFAULT_TABS,
    @Optional() @Inject(CASE_TAB_TOKEN) private readonly caseTabConfig: CaseTabConfig,
    @Optional()
    @Inject(ZGW_OBJECT_TYPE_COMPONENT_TOKEN)
    private readonly zgwObjectTypeComponent: Type<any>,
    private readonly configService: ConfigService,
    private readonly route: ActivatedRoute,
    private readonly caseTabApiService: CaseTabApiService
  ) {
    this._tabManagementEnabled =
      this.configService.config.featureToggles?.enableTabManagement ?? true;
    this.openCaseDefinitionKeySubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public setTabLoader(tabLoader: TabLoaderImpl): void {
    this._tabLoader$.next(tabLoader);
  }

  public disableTabHorizontalOverflow(): void {
    this._tabHorizontalOverflowDisabled.set(true);
  }

  public enableTabHorizontalOverflow(): void {
    this._tabHorizontalOverflowDisabled.set(false);
  }

  private getConfigurableTabs(caseDefinitionKey: string): Map<string, object> {
    const tabMap = new Map<string, object>();

    if (this.configService?.config?.caseObjectTypes) {
      const allNamesObjects = this.configService?.config?.caseObjectTypes[caseDefinitionKey];

      allNamesObjects?.forEach(name => {
        tabMap.set(name, this.zgwObjectTypeComponent || CaseDetailTabNotFoundComponent);
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

  private openCaseDefinitionKeySubscription(): void {
    this._subscriptions.add(
      combineLatest([this._caseDefinitionKey$, this._documentId$]).subscribe(
        ([caseDefinitionKey, documentId]) => {
          if (this._tabManagementEnabled) {
            this.setApiTabs(caseDefinitionKey, documentId);
          } else {
            this.setEnvironmentTabs(caseDefinitionKey);
          }
        }
      )
    );
  }

  private setEnvironmentTabs(caseDefinitionKey: string): void {
    const configurableTabs = this.getConfigurableTabs(caseDefinitionKey);
    const allEnvironmentTabs = this.getAllEnvironmentTabs(configurableTabs);
    this._tabs$.next(allEnvironmentTabs);
  }

  private setApiTabs(caseDefinitionKey: string, documentId: string): void {
    this.caseTabApiService.getDossierTabs(caseDefinitionKey, documentId).subscribe({
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
          tab.name ?? '',
          tab.showTasks
        );
      case ApiTabType.FORMIO:
        return new TabImpl(
          tab.key,
          index,
          CaseDetailTabFormioComponent,
          tab.contentKey,
          tab.name ?? '',
          tab.showTasks
        );
      case ApiTabType.CUSTOM:
        return new TabImpl(
          tab.key,
          index,
          this.caseTabConfig[tab.contentKey],
          tab.contentKey,
          tab.name ?? '',
          tab.showTasks
        );
      case ApiTabType.WIDGETS:
        return new TabImpl(
          tab.key,
          index,
          CaseDetailWidgetsComponent,
          tab.contentKey,
          tab.name ?? '',
          tab.showTasks
        );
      default:
        return null;
    }
  }
}
