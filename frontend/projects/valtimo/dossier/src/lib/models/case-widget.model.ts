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

import {CaseWidgetDisplayType} from '.';
import {Type} from '@angular/core';
import {
  WidgetCollectionContent,
  WidgetContentProperties,
  WidgetCustomContent,
  WidgetFieldsContent,
  WidgetTableContent,
} from './case-widget-content.model';

enum CaseWidgetType {
  FIELDS = 'fields',
  TABLE = 'table',
  CUSTOM = 'custom',
  COLLECTION = 'collection',
  FORMIO = 'formio',
}

type CaseWidgetWidth = 1 | 2 | 3 | 4;
type CollectionFieldWidth = 'half' | 'full';

interface BasicCaseWidget {
  type: CaseWidgetType;
  title: string;
  width: CaseWidgetWidth;
  highContrast: boolean;
  key: string;
  properties: WidgetContentProperties;
}

interface FieldsCaseWidgetValue {
  key: string;
  title: string;
  value: string;
  displayProperties?: CaseWidgetDisplayType;
}

interface FieldsCaseWidget extends BasicCaseWidget {
  type: CaseWidgetType.FIELDS;
  properties: WidgetFieldsContent;
}

interface CollectionCaseWidget extends BasicCaseWidget {
  type: CaseWidgetType.COLLECTION;
  properties: WidgetCollectionContent;
}

interface TableCaseWidget extends BasicCaseWidget {
  type: CaseWidgetType.TABLE;
  properties: WidgetTableContent;
}

interface CustomCaseWidget extends BasicCaseWidget {
  type: CaseWidgetType.CUSTOM;
  properties: WidgetCustomContent;
}

interface FormioCaseWidget extends BasicCaseWidget {
  type: CaseWidgetType.FORMIO;
  properties: {
    formDefinitionName: string;
  };
}

type CaseWidget =
  | FieldsCaseWidget
  | CollectionCaseWidget
  | CustomCaseWidget
  | TableCaseWidget
  | FormioCaseWidget;

type CaseWidgetWithUuid = CaseWidget & {
  uuid: string;
};

type FormioCaseWidgetWidgetWithUuid = FormioCaseWidget & {
  uuid: string;
};

interface CaseWidgetsRes {
  caseDefinitionName: string;
  key: string;
  widgets: BasicCaseWidget[];
}

interface CaseWidgetWidthsPx {
  [uuid: string]: number;
}

interface CaseWidgetContentHeightsPx {
  [uuid: string]: number;
}

interface CaseWidgetContentHeightsPxWithContainerWidth {
  [uuid: string]: {
    containerWidth: number;
    height: number;
  };
}

interface CaseWidgetConfigurationBin {
  configurationKey: string;
  width: number;
  height: number;
}

interface CaseWidgetPackResultItem {
  width: number;
  height: number;
  x: number;
  y: number;
  item: CaseWidgetConfigurationBin;
}

interface CaseWidgetPackResult {
  height: number;
  width: number;
  items: CaseWidgetPackResultItem[];
}

interface MaxRectsResult extends CaseWidgetConfigurationBin {
  x: number;
  y: number;
}

interface CaseWidgetPackResultItemsByRow {
  [rowY: string]: CaseWidgetPackResultItem[];
}

interface CaseWidgetXY {
  x: number;
  y: number;
}

interface CustomCaseWidgetConfig {
  [componentKey: string]: Type<any>;
}

export {
  BasicCaseWidget,
  CaseWidget,
  CaseWidgetConfigurationBin,
  CaseWidgetContentHeightsPx,
  CaseWidgetContentHeightsPxWithContainerWidth,
  CaseWidgetPackResult,
  CaseWidgetsRes,
  CaseWidgetType,
  CaseWidgetWidth,
  CaseWidgetWidthsPx,
  CaseWidgetWithUuid,
  CaseWidgetXY,
  CollectionFieldWidth,
  FieldsCaseWidget,
  FieldsCaseWidgetValue,
  CollectionCaseWidget,
  CustomCaseWidgetConfig,
  CustomCaseWidget,
  TableCaseWidget,
  CaseWidgetPackResultItem,
  CaseWidgetPackResultItemsByRow,
  FormioCaseWidgetWidgetWithUuid,
  MaxRectsResult,
};
