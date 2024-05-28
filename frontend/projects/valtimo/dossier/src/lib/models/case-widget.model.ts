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

enum CaseWidgetType {
  FIELDS = 'fields',
}

type CaseWidgetWidth = 1 | 2 | 3 | 4;

interface BasicCaseWidget {
  title: string;
  width: CaseWidgetWidth;
  highContrast: boolean;
  key: string;
}

interface FieldsCaseWidgetValue {
  key: string;
  title: string;
  value: string;
  displayProperties?: CaseWidgetDisplayType;
}

interface FieldsCaseWidget extends BasicCaseWidget {
  type: CaseWidgetType.FIELDS;
  properties: {
    columns: FieldsCaseWidgetValue[][];
  };
}

type CaseWidget = FieldsCaseWidget;

interface CaseWidgetWithUuid extends CaseWidget {
  uuid: string;
}

interface CaseWidgetsRes {
  caseDefinitionName: string;
  key: string;
  widgets: CaseWidget[];
}

interface CaseWidgetWidthsPx {
  [uuid: string]: number;
}

interface CaseWidgetContentHeightsPx {
  [uuid: string]: number;
}

interface CaseWidgetConfigurationBin {
  configurationKey: string;
  width: number;
  height: number;
}

interface CaseWidgetPackResult {
  height: number;
  width: number;
  items: Array<{
    width: number;
    height: number;
    x: number;
    y: number;
    item: CaseWidgetConfigurationBin;
  }>;
}

interface CaseWidgetXY {
  x: number;
  y: number;
}

export {
  FieldsCaseWidget,
  CaseWidget,
  CaseWidgetsRes,
  CaseWidgetWithUuid,
  CaseWidgetWidthsPx,
  CaseWidgetContentHeightsPx,
  CaseWidgetConfigurationBin,
  CaseWidgetPackResult,
  CaseWidgetXY,
};
