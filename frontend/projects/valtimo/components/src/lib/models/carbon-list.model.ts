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
import {TemplateRef} from '@angular/core';
import {TableRowSize} from 'carbon-components-angular';

enum ViewType {
  ACTION = 'dropdownActions',
  ARRAY_COUNT = 'arrayCount',
  BOOLEAN = 'boolean',
  DATE = 'date',
  ENUM = 'enum',
  TEMPLATE = 'template',
  TEXT = 'text',
  UNDERSCORES_TO_SPACES = 'underscoresToSpaces',
}
interface CarbonListSelectTranslations {
  single: string;
  multiple: string;
}

interface CarbonListPaginationTranslations {
  itemsPerPage: string;
  totalItem: string;
  totalItems: string;
}

interface CarbonListItem {
  [key: string]: any;
  locked?: boolean;
}

interface CarbonListTranslations {
  select: CarbonListSelectTranslations;
  pagination: CarbonListPaginationTranslations;
}

interface CarbonListBatchText {
  SINGLE: string;
  MULTIPLE: string;
}

interface ActionItem {
  label: string;
  callback: (_) => void;
  iconClass?: string;
  type?: 'normal' | 'danger';
}

interface ColumnConfig extends ListField {
  viewType: string | ViewType;
  actions?: ActionItem[];
  className?: string;
  format?: string;
  enum?: Array<string> | {[key: string]: string};
  template?: TemplateRef<any>;
}

const DEFAULT_LIST_TRANSLATIONS: CarbonListTranslations = {
  select: {single: 'interface.list.singleSelect', multiple: 'interface.list.multipleSelect'},
  pagination: {
    itemsPerPage: 'interface.list.itemsPerPage',
    totalItem: 'interface.list.totalItem',
    totalItems: 'interface.list.totalItems',
  },
};

interface ListField {
  key: string;
  label: string;
  viewType?: string;
  default?: string | boolean;
  sortable?: boolean;
}

export {
  ActionItem,
  CarbonListBatchText,
  CarbonListSelectTranslations,
  CarbonListItem,
  CarbonListTranslations,
  ColumnConfig,
  DEFAULT_LIST_TRANSLATIONS,
  ListField,
  ViewType,
};
