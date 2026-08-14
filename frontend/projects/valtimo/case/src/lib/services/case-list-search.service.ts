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

import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable, of, switchMap} from 'rxjs';
import {SearchField, SearchFieldValues, SearchFilter, SearchFilterRange} from '@valtimo/shared';
import {CaseListService} from './case-list.service';
import {DocumentService} from '@valtimo/document';
import {CaseParameterService} from './case-parameter.service';

@Injectable()
export class CaseListSearchService {
  private readonly _documentSearchFields$: Observable<Array<SearchField> | null> =
    this.caseListService.caseDefinitionKey$.pipe(
      switchMap(caseDefinitionKey =>
        caseDefinitionKey
          ? this.documentService.getDocumentSearchFields(caseDefinitionKey)
          : of([])
      )
    );

  private readonly _globalSearchFilter$ = new BehaviorSubject<string>('');

  public get documentSearchFields$(): Observable<Array<SearchField> | null> {
    return this._documentSearchFields$;
  }

  public get globalSearchFilter$(): Observable<string> {
    return this._globalSearchFilter$.asObservable();
  }

  constructor(
    private readonly caseListService: CaseListService,
    private readonly documentService: DocumentService,
    private readonly caseParameterService: CaseParameterService
  ) {}

  public setGlobalSearchFilter(value: string | null): void {
    this._globalSearchFilter$.next(value ?? '');
    this.caseListService.checkRefresh();
  }

  public search(searchFieldValues: SearchFieldValues): void {
    this.caseParameterService.setSearchFieldValues(searchFieldValues || {});
    this.caseParameterService.setSearchParameters(searchFieldValues);
    this.caseListService.checkRefresh();
  }

  public mapSearchValuesToFilters(
    values: SearchFieldValues
  ): Array<SearchFilter | SearchFilterRange> {
    const filters: Array<SearchFilter | SearchFilterRange> = [];

    Object.keys(values).forEach(valueKey => {
      const searchValue = values[valueKey] as any;
      if (searchValue.start) {
        filters.push({key: valueKey, rangeFrom: searchValue.start, rangeTo: searchValue.end});
      } else if (Array.isArray(searchValue)) {
        filters.push({key: valueKey, values: searchValue});
      } else {
        filters.push({key: valueKey, values: [searchValue]});
      }
    });

    return filters;
  }
}
