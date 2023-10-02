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
  ACTION = 'action',
  ARRAY_COUNT = 'arrayCount',
  BOOLEAN = 'boolean',
  DATE = 'date',
  ENUM = 'enum',
  TEMPLATE = 'template',
  TEXT = 'text',
  UNDERSCORES_TO_SPACES = 'underscoresToSpaces',
}

interface CarbonTableSelectTranslations {
  single: string;
  multiple: string;
}

interface CarbonTableBatchText {
  SINGLE: string;
  MULTIPLE: string;
}

interface CarbonTableConfig {
  enableSingleSelect?: boolean;
  searchable?: boolean;
  selectTranslations?: CarbonTableSelectTranslations;
  showSelectionColumn?: boolean;
  size?: TableRowSize;
  sortable?: boolean;
  striped?: boolean;
  withPagination?: boolean;
}

interface ActionItem {
  actionName: string;
  callback: (_) => void;
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

const defaultTableConfig: CarbonTableConfig = {
  enableSingleSelect: false,
  searchable: false,
  size: 'md',
  showSelectionColumn: false,
  sortable: true,
  striped: false,
  withPagination: false,
};

interface ListField {
  key: string;
  label: string;
  viewType: string;
  default?: string | boolean;
  sortable?: boolean;
}

const createCarbonTableConfig = (config?: CarbonTableConfig): CarbonTableConfig => ({
  ...defaultTableConfig,
  ...config,
});

export {
  ActionItem,
  CarbonTableBatchText,
  CarbonTableConfig,
  CarbonTableSelectTranslations,
  ColumnConfig,
  createCarbonTableConfig,
  ListField,
  ViewType,
};
