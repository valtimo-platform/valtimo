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

import {HttpParams} from '@angular/common/http';
import {SortState} from './index';
import {AssigneeFilter, SearchFilter, SearchFilterRange, SearchOperator} from '@valtimo/config';

export interface AdvancedDocumentSearchRequest {
  definitionName: string;
  page: number;
  size: number;
  sort?: SortState;

  asHttpBody(): AdvancedDocumentSearchRequestHttpBody;
  asHttpParams(): HttpParams;
  setPage(page: number): void;
  getSortString(sort: SortState): string;
}

export class AdvancedDocumentSearchRequestHttpBody {
  documentDefinitionName?: string;
  sequence?: number;
  createdBy?: string;
  searchOperator?: SearchOperator;
  otherFilters?: Array<SearchFilter | SearchFilterRange>;
  assigneeFilter?: AssigneeFilter;
}

export class AdvancedDocumentSearchRequestImpl implements AdvancedDocumentSearchRequest {
  definitionName: string;
  page: number;
  size: number;
  sort?: SortState;
  searchOperator?: SearchOperator;
  otherFilters?: Array<SearchFilter | SearchFilterRange>;

  constructor(
    definitionName: string,
    page: number,
    size: number,
    sort?: SortState,
    searchOperator?: SearchOperator,
    otherFilters?: Array<SearchFilter | SearchFilterRange>
  ) {
    this.definitionName = definitionName;
    this.page = page;
    this.size = size;
    this.sort = sort;
    this.otherFilters = otherFilters;
    this.searchOperator = searchOperator;
  }

  asHttpBody(): AdvancedDocumentSearchRequestHttpBody {
    const httpBody = new AdvancedDocumentSearchRequestHttpBody();

    httpBody.documentDefinitionName = this.definitionName;

    if (this.otherFilters) {
      httpBody.otherFilters = this.otherFilters;
    }
    if (this.searchOperator) {
      httpBody.searchOperator = this.searchOperator;
    }

    return httpBody;
  }

  asHttpParams(): HttpParams {
    let params = new HttpParams()
      .set('definitionName', this.definitionName)
      .set('page', this.page.toString())
      .set('size', this.size.toString());
    if (this.sort) {
      params = params.set('sort', this.getSortString(this.sort));
    }
    return params;
  }

  setPage(page: number): void {
    this.page = page;
  }

  getSortString(sort: SortState): string {
    return `${sort.state.name},${sort.state.direction}`;
  }
}
