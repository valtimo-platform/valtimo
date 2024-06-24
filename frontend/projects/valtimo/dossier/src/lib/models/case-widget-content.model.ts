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

import {CaseWidgetDisplayType} from './case-widget-display.model';
import {CollectionFieldWidth, FieldsCaseWidgetValue} from './case-widget.model';

interface WidgetFieldsContent {
  columns: FieldsCaseWidgetValue[][];
}

type CollectionCaseWidgetFieldWidth = 'full' | 'half';

interface CollectionCaseWidgetField {
  key: string;
  title: string;
  value: string;
  width: CollectionCaseWidgetFieldWidth;
  displayProperties?: CaseWidgetDisplayType;
}

interface CollectionCaseWidgetTitle {
  value: string;
  displayProperties?: CaseWidgetDisplayType;
}

interface WidgetCollectionContent {
  collection: string;
  defaultPageSize: number;
  title: CollectionCaseWidgetTitle;
  fields: CollectionCaseWidgetField[];
}

interface CollectionWidgetResolvedField {
  key: string;
  title: string;
  value: string;
  width: CollectionCaseWidgetFieldWidth;
}

interface CollectionCaseWidgetCardData {
  title: string;
  fields: {[key: string]: string};
  hidden?: boolean;
}

interface WidgetTableContent {
  columns: FieldsCaseWidgetValue[];
  collection: string;
  firstColumnAsTitle: boolean;
  defaultPageSize: number;
}

interface WidgetCustomContent {
  componentKey: string;
}

interface WidgetFormioContent {
  formDefinitionName: string;
}

type WidgetContentProperties =
  | WidgetFieldsContent
  | WidgetTableContent
  | WidgetCustomContent
  | WidgetFormioContent
  | WidgetCollectionContent;

export {
  WidgetContentProperties,
  WidgetCustomContent,
  WidgetFieldsContent,
  WidgetFormioContent,
  WidgetTableContent,
  WidgetCollectionContent,
  CollectionCaseWidgetField,
  CollectionCaseWidgetFieldWidth,
  CollectionWidgetResolvedField,
  CollectionCaseWidgetTitle,
  CollectionCaseWidgetCardData,
};
