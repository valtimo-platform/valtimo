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
import {Type} from '@angular/core';
import {
  WidgetCollectionContent,
  WidgetContentProperties,
  WidgetCustomContent,
  WidgetFieldsContent,
  WidgetInteractiveTableContent,
  WidgetMapContent,
  WidgetTableContent,
} from './widget-content.model';
import {WidgetDisplayType} from './widget-display.model';
import {Condition} from '@valtimo/shared';

enum WidgetType {
  FIELDS = 'fields',
  INTERACTIVE_TABLE = 'interactive-table',
  TABLE = 'table',
  CUSTOM = 'custom',
  COLLECTION = 'collection',
  FORMIO = 'formio',
  DIVIDER = 'divider',
  MAP = 'map',
}

type WidgetWidth = 1 | 2 | 3 | 4;
type CollectionFieldWidth = 'half' | 'full';

interface WidgetAction {
  name?: string;
  processDefinitionKey?: string;
  caseDefinitionKey?: string;
  navigateTo?: string;
}

interface BasicWidget {
  type: WidgetType;
  title: string;
  icon?: string;
  width: WidgetWidth;
  highContrast: boolean;
  key: string;
  properties?: WidgetContentProperties;
  actions?: WidgetAction[];
  displayConditions: Array<Condition<string>>;
}

interface FieldsWidgetValue {
  key: string;
  title: string;
  value: string;
  ellipsisCharacterLimit?: number;
  displayProperties?: WidgetDisplayType;
}

interface GeoJsonSource {
  key: string;
}

interface MapData {
  geoJsonFeatureCollection: any;
}

interface FieldsWidget extends BasicWidget {
  type: WidgetType.FIELDS;
  properties: WidgetFieldsContent;
}

interface CollectionWidget extends BasicWidget {
  type: WidgetType.COLLECTION;
  properties: WidgetCollectionContent;
}

interface TableWidget extends BasicWidget {
  type: WidgetType.TABLE;
  properties: WidgetTableContent;
}

interface InteractiveTableWidget extends BasicWidget {
  type: WidgetType.INTERACTIVE_TABLE;
  properties: WidgetInteractiveTableContent;
}

interface InteractiveTableWidget extends BasicWidget {
  type: WidgetType.INTERACTIVE_TABLE;
  properties: WidgetInteractiveTableContent;
}

interface CustomWidget extends BasicWidget {
  type: WidgetType.CUSTOM;
  properties: WidgetCustomContent;
}

interface FormioWidget extends BasicWidget {
  type: WidgetType.FORMIO;
  properties: {
    formDefinitionName: string;
  };
}

interface DividerWidget extends BasicWidget {
  type: WidgetType.DIVIDER;
}

interface MapWidget extends BasicWidget {
  type: WidgetType.MAP;
  properties: WidgetMapContent;
}

type Widget =
  | FieldsWidget
  | CollectionWidget
  | CustomWidget
  | TableWidget
  | InteractiveTableWidget
  | FormioWidget
  | DividerWidget
  | MapWidget;

type WidgetWithUuid = Widget & {
  uuid: string;
};

type FormioWidgetWidgetWithUuid = FormioWidget & {
  uuid: string;
};

interface WidgetWidthsPx {
  [uuid: string]: number;
}

interface WidgetContentHeightsPx {
  [uuid: string]: number;
}

interface WidgetContentHeightsPxWithContainerWidth {
  [uuid: string]: {
    containerWidth: number;
    height: number;
  };
}

interface WidgetConfigurationBin {
  configurationKey: string;
  width: number;
  height: number;
}

interface WidgetPackResultItem {
  width: number;
  height: number;
  x: number;
  y: number;
  item: WidgetConfigurationBin;
}

interface WidgetPackResult {
  height: number;
  width: number;
  items: WidgetPackResultItem[];
}

interface MaxRectsResult extends WidgetConfigurationBin {
  x: number;
  y: number;
}

interface WidgetPackResultItemsByRow {
  [rowY: string]: WidgetPackResultItem[];
}

interface WidgetXY {
  x: number;
  y: number;
}

interface CustomWidgetConfig {
  [componentKey: string]: Type<any>;
}

interface WidgetGroup {
  divider: DividerWidget | null;
  widgets: Widget[];
}

type WidgetComponentMap = Record<Exclude<WidgetType, WidgetType.DIVIDER>, Type<any>>;

type WidgetContext = 'case' | 'iko';

export {
  BasicWidget,
  Widget,
  WidgetAction,
  WidgetConfigurationBin,
  WidgetContentHeightsPx,
  WidgetContentHeightsPxWithContainerWidth,
  WidgetPackResult,
  WidgetType,
  WidgetWidth,
  WidgetWidthsPx,
  WidgetWithUuid,
  WidgetXY,
  CollectionFieldWidth,
  DividerWidget,
  FieldsWidget,
  FieldsWidgetValue,
  GeoJsonSource,
  MapData,
  CollectionWidget,
  CustomWidgetConfig,
  CustomWidget,
  TableWidget,
  InteractiveTableWidget,
  MapWidget,
  WidgetPackResultItem,
  WidgetPackResultItemsByRow,
  FormioWidgetWidgetWithUuid,
  MaxRectsResult,
  WidgetComponentMap,
  WidgetContext,
  WidgetGroup,
};
