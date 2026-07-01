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

interface ColumnFilterConfig {
  label: string;
  path: string; // Object path, e.g., record.data.name, record.registrationAt
  sortable?: boolean;
  defaultSortDirection?: 'none' | 'asc' | 'desc';
  viewType?: 'text' | 'date' | 'boolean';
  filterable?: boolean;
  filterType?: 'exact' | 'icontains' | 'gte' | 'lte' | 'range';
  inputType?: 'text' | 'dropdown' | 'date' | 'dateRange';
  dropdownOptionsJson?: string;
}

interface DropdownOption {
  value: string;
  label: string;
}

interface ObjectManagementSelectValue {
  id: string;
  [key: string]: any;
}

interface ObjectsPage {
  content: ObjectWrapper[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

interface ObjectWrapper {
  url: string;
  uuid: string;
  type: string;
  record: {
    index: number;
    typeVersion: number;
    data: Record<string, any>;
    startAt: string;
    registrationAt: string;
  };
}

export {
  ColumnFilterConfig,
  DropdownOption,
  ObjectManagementSelectValue,
  ObjectsPage,
  ObjectWrapper,
};
