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

import {Page} from '@valtimo/shared';

interface IkoDataAggregate {
  key: string;
  title: string;
}

interface IkoDataRequestUser {
  key: string;
  title: string;
  searchFields: SearchFieldV2[];
}

interface SearchFieldV2 {
  id: string;
  ownerId: string;
  ownerType: string;
  key: string;
  title?: string;
  path: string;
  order: number;
  dataType: string;
  fieldType: string;
  matchType?: string;
  dropdownDataProvider?: string;
}

interface IkoListHeader {
  key: string;
  title: string;
  displayType: {
    type: string;
    displayTypeParameters: object;
  };
  sortable: boolean;
  defaultSort: null | 'ASC' | 'DESC';
}

interface IkoListItem {
  key: string;
  value: string;
}

interface IkoListResponse {
  headers: IkoListHeader[];
  rows: Page<{items: IkoListItem[]}>;
}

export {
  IkoDataAggregate,
  IkoDataRequestUser,
  SearchFieldV2,
  IkoListHeader,
  IkoListItem,
  IkoListResponse,
};
