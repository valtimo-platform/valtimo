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
} from './case-widget-content.model';
import {CaseWidgetDisplayType} from './case-widget-display.model';
import {Condition} from '@valtimo/shared';
import { BasicWidget } from '@valtimo/layout';

enum CaseWidgetType {
  FIELDS = 'fields',
  TABLE = 'table',
  CUSTOM = 'custom',
  COLLECTION = 'collection',
  FORMIO = 'formio',
  DIVIDER = 'divider',
}

type CaseWidgetWidth = 1 | 2 | 3 | 4;
type CollectionFieldWidth = 'half' | 'full';

interface CaseWidgetAction {
  name?: string;
  processDefinitionKey: string;
}

interface BasicCaseWidget {
  type: CaseWidgetType;
  title: string;
  width: CaseWidgetWidth;
  highContrast: boolean;
  key: string;
  properties?: WidgetContentProperties;
  actions?: CaseWidgetAction[];
  displayConditions: Array<Condition>;
}

interface FieldsCaseWidgetValue {
  key: string;
  title: string;
  value: string;
  ellipsisCharacterLimit?: number;
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

interface DividerCaseWidget extends BasicCaseWidget {
  type: CaseWidgetType.DIVIDER;
}

type CaseWidget =
  | FieldsCaseWidget
  | CollectionCaseWidget
  | CustomCaseWidget
  | TableCaseWidget
  | FormioCaseWidget
  | DividerCaseWidget;

interface CaseWidgetsRes {
  caseDefinitionKey: string;
  caseDefinitionVersionTag: string;
  key: string;
  widgets: BasicWidget[];
}

interface CustomCaseWidgetConfig {
  [componentKey: string]: Type<any>;
}

interface CaseWidgetGroup {
  divider: DividerCaseWidget | null;
  widgets: CaseWidget[];
}

export {
  BasicCaseWidget,
  CaseWidget,
  CaseWidgetAction,
  CaseWidgetsRes,
  CaseWidgetType,
  CaseWidgetWidth,
  CollectionFieldWidth,
  FieldsCaseWidget,
  FieldsCaseWidgetValue,
  CollectionCaseWidget,
  CustomCaseWidgetConfig,
  CustomCaseWidget,
  TableCaseWidget,
  CaseWidgetGroup,
  DividerCaseWidget
};
