import {TemplateRef} from '@angular/core';
import {TableRowSize} from 'carbon-components-angular';

export enum ColumnType {
  ACTION = 'action',
  TEMPLATE = 'template',
  TEXT = 'text',
}

export interface CarbonTableConfig {
  fields: ColumnConfig[];
  enableSingleSelect?: boolean;
  searchable?: boolean;
  showSelectionColumn?: boolean;
  size?: TableRowSize;
  sortable?: boolean;
  striped?: boolean;
  withPagination?: boolean;
}

export interface ActionItem {
  actionName: string;
  callback: (_) => void;
  type?: 'normal' | 'danger';
}

export interface ColumnConfig {
  columnType: ColumnType;
  fieldName: string;
  translationKey: string;
  actions?: ActionItem[];
  className?: string;
  sortable?: boolean;
  template?: TemplateRef<any>;
}

const defaultTableConfig: CarbonTableConfig = {
  fields: [],
  enableSingleSelect: false,
  searchable: false,
  size: 'md',
  showSelectionColumn: false,
  sortable: true,
  striped: false,
  withPagination: false,
};

export const createCarbonTableConfig = (config: CarbonTableConfig): CarbonTableConfig => ({
  ...defaultTableConfig,
  ...config,
});
