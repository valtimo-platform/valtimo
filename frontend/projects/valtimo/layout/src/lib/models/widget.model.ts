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
  WidgetTableContent,
} from './widget-content.model';
import {WidgetDisplayType} from './widget-display.model';

enum WidgetType {
  FIELDS = 'fields',
  TABLE = 'table',
  CUSTOM = 'custom',
  COLLECTION = 'collection',
  FORMIO = 'formio',
}

type WidgetWidth = 1 | 2 | 3 | 4;
type CollectionFieldWidth = 'half' | 'full';

interface WidgetAction {
  name?: string;
  processDefinitionKey: string;
}

interface BasicWidget {
  type: WidgetType;
  title: string;
  width: WidgetWidth;
  highContrast: boolean;
  key: string;
  properties: WidgetContentProperties;
  actions?: WidgetAction[];
}

interface FieldsWidgetValue {
  key: string;
  title: string;
  value: string;
  ellipsisCharacterLimit?: number;
  displayProperties?: WidgetDisplayType;
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

type Widget = FieldsWidget | CollectionWidget | CustomWidget | TableWidget | FormioWidget;

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

interface CaseWidgetXY {
  x: number;
  y: number;
}

interface CustomWidgetConfig {
  [componentKey: string]: Type<any>;
}

type WidgetComponentMap = Record<WidgetType, Type<any>>;

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
  CaseWidgetXY,
  CollectionFieldWidth,
  FieldsWidget,
  FieldsWidgetValue,
  CollectionWidget,
  CustomWidgetConfig,
  CustomWidget,
  TableWidget,
  WidgetPackResultItem,
  WidgetPackResultItemsByRow,
  FormioWidgetWidgetWithUuid,
  MaxRectsResult,
  WidgetComponentMap,
};
