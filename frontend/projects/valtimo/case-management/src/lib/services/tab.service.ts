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
import {Inject, Injectable, Optional} from '@angular/core';
import {ActivatedRoute, Route, Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {CASE_TAB_TOKEN, CaseTabConfig, DefaultTabs} from '@valtimo/case';
import {
  CASE_MANAGEMENT_TAB_TOKEN,
  CaseManagementParams,
  CaseManagementTabConfig,
  getCaseManagementRouteParams,
} from '@valtimo/shared';
import {FormDefinitionOption, FormService} from '@valtimo/form';
import {ListItem} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, map, Observable, of, switchMap} from 'rxjs';
import {TabEnum} from '../models';

@Injectable({
  providedIn: 'root',
})
export class TabService {
  public configuredTabKeys: string[];

  private _injectedCaseManagementTabs$ = new BehaviorSubject<CaseManagementTabConfig[]>([]);

  public get injectedCaseManagementTabs$(): Observable<CaseManagementTabConfig[]> {
    return this._injectedCaseManagementTabs$.asObservable();
  }

  private _currentTab$ = new BehaviorSubject<TabEnum | string>(TabEnum.DOCUMENT);
  public get currentTab$(): Observable<TabEnum | string> {
    return this._currentTab$.asObservable();
  }
  public set currentTab(tab: TabEnum | string) {
    this._currentTab$.next(tab);
  }

  private _configuredContentKeys$ = new BehaviorSubject<string[]>([]);
  public get configuredContentKeys$(): Observable<string[]> {
    return this._configuredContentKeys$.asObservable();
  }
  public set configuredContentKeys(value: string[]) {
    this._configuredContentKeys$.next(value);
  }

  public readonly customComponentKeys$ = new BehaviorSubject<ListItem[]>(
    !this.caseTabConfig
      ? []
      : Object.keys(this.caseTabConfig).map((contentKey: string) => ({
          contentKey,
          content: contentKey,
          selected: false,
        }))
  );

  public readonly defaultTabs$: Observable<ListItem[]> = this.translateService.stream('key').pipe(
    map(() =>
      Object.values(DefaultTabs).map((key: string) => ({
        contentKey: key,
        content: this.translateService.instant(`case.tabs.${key}`),
        selected: false,
      }))
    )
  );

  constructor(
    @Optional() @Inject(CASE_TAB_TOKEN) private readonly caseTabConfig: CaseTabConfig,
    @Optional()
    @Inject(CASE_MANAGEMENT_TAB_TOKEN)
    private readonly caseManagementTabConfig: CaseManagementTabConfig[],
    private readonly formService: FormService,
    private readonly translateService: TranslateService,
    private readonly router: Router
  ) {
    this.setInjectedCaseManagementTabs(this.caseManagementTabConfig);
  }

  /**
   * Register case-management tabs after bootstrap — used when a plugin is loaded
   * at runtime (e.g. a Native Federation remote) instead of being compiled into
   * the app via the CASE_MANAGEMENT_TAB_TOKEN provider. Besides adding the tab to
   * the reactive stream, it registers the tab's child route on the case-details
   * route, mirroring what CaseManagementRoutingModule does at bootstrap (that
   * module has already run by the time a remote loads). Idempotent by tab route.
   */
  public registerCaseManagementTabs(
    caseManagementTabConfig?: CaseManagementTabConfig[] | CaseManagementTabConfig
  ): void {
    if (!caseManagementTabConfig) return;
    const incoming = Array.isArray(caseManagementTabConfig)
      ? caseManagementTabConfig
      : [caseManagementTabConfig];

    const current = this._injectedCaseManagementTabs$.getValue();
    const knownRoutes = new Set(current.map(tab => tab.tabRoute ?? tab.translationKey));
    const additions = incoming
      .filter(tab => !knownRoutes.has(tab.tabRoute ?? tab.translationKey))
      .map(tab => ({...tab, enabled$: tab.enabled$ ?? of(true)}));

    if (additions.length === 0) return;

    this._injectedCaseManagementTabs$.next([...current, ...additions]);
    this.registerTabRoutes(additions);
  }

  private registerTabRoutes(tabs: CaseManagementTabConfig[]): void {
    const detailsRoute: Route | undefined = this.router.config.find(
      (route: Route) => route.data?.id === 'caseManagementDetails'
    );
    if (!detailsRoute?.children) return;

    tabs.forEach(tab => {
      const path = tab.tabRoute ?? tab.translationKey;
      if (!detailsRoute.children!.some((child: Route) => child.path === path)) {
        detailsRoute.children!.push({path, component: tab.component});
      }
    });
  }

  public getDisabledAddTabs(route: ActivatedRoute): Observable<{
    standard: boolean;
    custom: boolean;
    formIO: boolean;
    widgets: boolean;
  }> {
    return combineLatest([
      this.configuredContentKeys$,
      this.getFormDefinitions(route),
      this.defaultTabs$,
      this.customComponentKeys$,
    ]).pipe(
      map(([tabKeys, formDefinitions, defaultTabs, customComponentKeys]) => ({
        standard: defaultTabs.every((tabItem: ListItem) => tabKeys.includes(tabItem.contentKey)),
        custom:
          !customComponentKeys.length ||
          customComponentKeys.every((tabItem: ListItem) => tabKeys.includes(tabItem.contentKey)),
        formIO:
          !formDefinitions.length ||
          formDefinitions.every((tabItem: ListItem) => tabKeys.includes(tabItem.contentKey)),
        widgets: false,
      }))
    );
  }

  public getFormDefinitions(route: ActivatedRoute): Observable<ListItem[]> {
    return getCaseManagementRouteParams(route).pipe(
      switchMap((params: CaseManagementParams) => {
        return this.formService
          .getAllFormDefinitionsForCaseDefinition(
            params.caseDefinitionKey,
            params.caseDefinitionVersionTag
          )
          .pipe(
            map((formDefinitions: FormDefinitionOption[]) => {
              return formDefinitions.map((formDefinition: FormDefinitionOption) => ({
                contentKey: formDefinition.name,
                content: formDefinition.name,
                selected: false,
              }));
            })
          );
      })
    );
  }

  private setInjectedCaseManagementTabs(
    caseManagementTabConfig?: CaseManagementTabConfig[] | CaseManagementTabConfig
  ): void {
    if (!caseManagementTabConfig) return;
    const tabs = Array.isArray(caseManagementTabConfig)
      ? caseManagementTabConfig
      : [caseManagementTabConfig];

    this._injectedCaseManagementTabs$.next(
      tabs.map(tab => ({...tab, enabled$: tab.enabled$ ?? of(true)}))
    );
  }
}
