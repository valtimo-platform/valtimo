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
  skeleton?: boolean;
  sortable?: boolean;
  striped?: boolean;
}

export interface ActionItem {
  actionName: string;
  callback: (_) => void;
  type?: 'normal' | 'danger';
}

export interface ColumnConfig {
  columnType: ColumnType;
  fieldName: string;
  actions?: ActionItem[];
  fieldLabel?: string;
  template?: TemplateRef<any>;
  translationKey?: string;
}

const defaultTableConfig: CarbonTableConfig = {
  fields: [],
  enableSingleSelect: false,
  searchable: false,
  size: 'md',
  showSelectionColumn: true,
  sortable: true,
  skeleton: false,
  striped: false,
};

export const createCarbonTableConfig = (config: CarbonTableConfig): CarbonTableConfig => ({
  ...defaultTableConfig,
  ...config,
});
