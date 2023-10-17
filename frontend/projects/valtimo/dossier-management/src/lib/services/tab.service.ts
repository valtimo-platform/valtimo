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
import {Inject, Injectable, Optional} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {CASE_TAB_TOKEN, CaseTabConfig, DefaultTabs} from '@valtimo/dossier';
import {FormDefinitionOption, FormService} from '@valtimo/form';
import {ListItem} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, map, Observable} from 'rxjs';

import {TabEnum} from '../models/tab.enum';

@Injectable({
  providedIn: 'root',
})
export class TabService {
  private _currentTab$ = new BehaviorSubject<TabEnum>(TabEnum.CASE);
  public get currentTab$(): Observable<TabEnum> {
    return this._currentTab$.asObservable();
  }
  public set currentTab(tab: TabEnum) {
    this._currentTab$.next(tab);
  }

  private _configuredTabKeys$ = new BehaviorSubject<string[]>([]);
  public get configuredTabKeys$(): Observable<string[]> {
    return this._configuredTabKeys$.asObservable();
  }
  public set configuredTabKeys(value: string[]) {
    this._configuredTabKeys$.next(value);
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
    this.configuredTabKeys$,
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
    private readonly formService: FormService,
    private readonly translateService: TranslateService
  ) {}
}
