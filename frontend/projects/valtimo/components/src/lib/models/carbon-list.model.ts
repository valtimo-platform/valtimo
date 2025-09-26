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
import {TemplateRef} from '@angular/core';
import {CarbonTag} from './carbon-tag.model';

enum ViewType {
  ACTION = 'dropdownActions',
  ARRAY_COUNT = 'arrayCount',
  BOOLEAN = 'boolean',
  CURRENCY = 'currency',
  DATE = 'date',
  DATE_TIME = 'datetime',
  ENUM = 'enum',
  NUMBER = 'number',
  PERCENT = 'percent',
  TAGS = 'tags',
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
  tags?: CarbonTag[];
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
  disabledCallback?: (_) => boolean;
  iconClass?: string;
  type?: 'normal' | 'danger';
}

interface ColumnConfig extends ListField {
  viewType: string | ViewType;
  className?: string;
  currencyCode?: string;
  digitsInfo?: string;
  display?: string;
  enum?: Array<string> | {[key: string]: string};
  format?: string;
  template?: TemplateRef<any>;
  templateData?: object;
  tooltipCharLimit?: number;
}

enum MoveRowDirection {
  UP = 'UP',
  DOWN = 'DOWN',
}

interface MoveRowEvent {
  direction: MoveRowDirection;
  index: number;
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

interface CarbonListNoResultsMessage {
  description: string;
  isSearchResult: boolean;
  title: string;
}

interface DragAndDropEvent {
  startIndex: number;
  newIndex: number;
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
  MoveRowDirection,
  MoveRowEvent,
  ViewType,
  CarbonListNoResultsMessage,
  DragAndDropEvent,
};
