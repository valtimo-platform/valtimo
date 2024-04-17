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
import {Inject, Injectable, Optional} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {CASE_TAB_TOKEN, CaseTabConfig, DefaultTabs} from '@valtimo/dossier';
import {FormDefinitionOption, FormService} from '@valtimo/form';
import {ListItem} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, map, Observable} from 'rxjs';
import {TabEnum} from '../models/tab.enum';
import {CASE_MANAGEMENT_TAB_TOKEN, CaseManagementTabConfig} from '@valtimo/config';

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

  public readonly formDefinitions$: Observable<ListItem[]> = this.formService
    .getAllFormDefinitions()
    .pipe(
      map((formDefinitions: FormDefinitionOption[]) =>
        formDefinitions.map((formDefinition: FormDefinitionOption) => ({
          contentKey: formDefinition.name,
          content: formDefinition.name,
          selected: false,
        }))
      )
    );

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
        content: this.translateService.instant(`dossier.tabs.${key}`),
        selected: false,
      }))
    )
  );

  public readonly disableAddTabs$: Observable<{
    standard: boolean;
    custom: boolean;
    formIO: boolean;
  }> = combineLatest([
    this.configuredContentKeys$,
    this.formDefinitions$,
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
    }))
  );

  constructor(
    @Optional() @Inject(CASE_TAB_TOKEN) private readonly caseTabConfig: CaseTabConfig,
    @Optional()
    @Inject(CASE_MANAGEMENT_TAB_TOKEN)
    private readonly caseManagementTabConfig: CaseManagementTabConfig[],
    private readonly formService: FormService,
    private readonly translateService: TranslateService
  ) {
    this.setInjectedCaseManagementTabs(this.caseManagementTabConfig);
  }

  private setInjectedCaseManagementTabs(
    caseManagementTabConfig?: CaseManagementTabConfig[] | CaseManagementTabConfig
  ): void {
    if (!caseManagementTabConfig) return;

    this._injectedCaseManagementTabs$.next(
      Array.isArray(caseManagementTabConfig) ? caseManagementTabConfig : [caseManagementTabConfig]
    );
  }
}
