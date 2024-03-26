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

import {Injectable} from '@angular/core';
import {Observable, switchMap} from 'rxjs';
import {SearchField, SearchFieldValues, SearchFilter, SearchFilterRange} from '@valtimo/config';
import {DossierListService} from './dossier-list.service';
import {DocumentService} from '@valtimo/document';
import {DossierParameterService} from './dossier-parameter.service';

@Injectable()
export class DossierListSearchService {
  private readonly _documentSearchFields$: Observable<Array<SearchField> | null> =
    this.dossierListService.documentDefinitionName$.pipe(
      switchMap(documentDefinitionName =>
        this.documentService.getDocumentSearchFields(documentDefinitionName)
      )
    );

  get documentSearchFields$(): Observable<Array<SearchField> | null> {
    return this._documentSearchFields$;
  }

  constructor(
    private readonly dossierListService: DossierListService,
    private readonly documentService: DocumentService,
    private readonly dossierParameterService: DossierParameterService
  ) {}

  search(searchFieldValues: SearchFieldValues): void {
    this.dossierParameterService.setSearchFieldValues(searchFieldValues || {});
    this.dossierParameterService.setSearchParameters(searchFieldValues);
    this.dossierListService.checkRefresh();
  }

  mapSearchValuesToFilters(values: SearchFieldValues): Array<SearchFilter | SearchFilterRange> {
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
