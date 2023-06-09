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
}

export interface ColumnConfig {
  fieldName: string;
  fieldLabel: string;
  columnType: ColumnType;
  actions?: ActionItem[];
  template?: TemplateRef<any>;
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
