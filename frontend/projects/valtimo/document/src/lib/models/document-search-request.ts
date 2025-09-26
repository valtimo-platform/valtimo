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

export interface DocumentSearchRequest {
  definitionName: string;
  page: number;
  size: number;
  sequence?: number;
  createdBy?: string;
  globalSearchFilter?: string;
  sort?: SortState;
  searchCriteria?: Array<{path: string; value: string}>;

  asHttpBody(): DocumentSearchRequestHttpBody;
  asHttpParams(): HttpParams;
  setPage(page: number): void;
  getSortString(sort: SortState): string;
}

export class DocumentSearchRequestHttpBody {
  documentDefinitionName?: string;
  sequence?: number;
  createdBy?: string;
  globalSearchFilter?: string;
  otherFilters?: Array<{path: string; value: string}>;
}

export class DocumentSearchRequestImpl implements DocumentSearchRequest {
  definitionName: string;
  page: number;
  size: number;
  sequence?: number;
  createdBy?: string;
  globalSearchFilter?: string;
  sort?: SortState;
  otherFilters?: Array<{path: string; value: string}>;

  constructor(
    definitionName: string,
    page: number,
    size: number,
    sequence?: number,
    createdBy?: string,
    globalSearchFilter?: string,
    sort?: SortState,
    otherFilters?: Array<{path: string; value: string}>
  ) {
    this.definitionName = definitionName;
    this.page = page;
    this.size = size;
    this.sequence = sequence;
    this.createdBy = createdBy;
    this.globalSearchFilter = globalSearchFilter;
    this.sort = sort;
    this.otherFilters = otherFilters;
  }

  asHttpBody(): DocumentSearchRequestHttpBody {
    const httpBody = new DocumentSearchRequestHttpBody();

    httpBody.documentDefinitionName = this.definitionName;

    if (this.sequence) {
      httpBody.sequence = this.sequence;
    }
    if (this.createdBy) {
      httpBody.createdBy = this.createdBy;
    }
    if (this.globalSearchFilter) {
      httpBody.globalSearchFilter = this.globalSearchFilter;
    }
    if (this.otherFilters) {
      httpBody.otherFilters = this.otherFilters;
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
