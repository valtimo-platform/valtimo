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

import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {QuickSearchItem} from '@valtimo/components';
import {BaseApiService, ConfigService, UserSettingsService} from '@valtimo/shared';
import {map, Observable, of, switchMap} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CaseListDefaultQuickSearchService extends BaseApiService {
  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService,
    private readonly userSettingsService: UserSettingsService
  ) {
    super(httpClient, configService);
  }

  public getDefaultTitle(caseDefinitionKey: string): Observable<string | null> {
    return this.userSettingsService
      .getUserSettings()
      .pipe(map(settings => settings?.caseListDefaultQuickSearches?.[caseDefinitionKey] ?? null));
  }

  public setDefaultTitle(caseDefinitionKey: string, title: string | null): Observable<void> {
    return this.userSettingsService.getUserSettings().pipe(
      switchMap(settings => {
        const defaults = {...(settings?.caseListDefaultQuickSearches || {})};

        if (title) defaults[caseDefinitionKey] = title;
        else delete defaults[caseDefinitionKey];

        // Only this key is sent: the backend merges settings per top-level key.
        return this.userSettingsService.saveUserSettings({caseListDefaultQuickSearches: defaults});
      }),
      map(() => undefined)
    );
  }

  public getDefaultQuickSearchItem(caseDefinitionKey: string): Observable<QuickSearchItem | null> {
    return this.getDefaultTitle(caseDefinitionKey).pipe(
      switchMap(title =>
        title
          ? this.httpClient
              .get<
                QuickSearchItem[]
              >(this.getApiUrl(`v1/case/${caseDefinitionKey}/stored-quick-search`))
              .pipe(map(items => items.find(item => item.title === title) ?? null))
          : of(null)
      )
    );
  }
}
