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

import {WidgetDisplayType} from './widget-display.model';
import {FieldsWidgetValue} from './widget.model';

interface WidgetFieldsContent {
  columns: FieldsWidgetValue[][];
}

type CollectionWidgetFieldWidth = 'full' | 'half';

interface CollectionWidgetField {
  key: string;
  title: string;
  value: string;
  width: CollectionWidgetFieldWidth;
  displayProperties?: WidgetDisplayType;
}

interface CollectionWidgetTitle {
  value: string;
  displayProperties?: WidgetDisplayType;
}

interface WidgetCollectionContent {
  collection: string;
  defaultPageSize: number;
  title: CollectionWidgetTitle;
  fields: CollectionWidgetField[];
}

interface CollectionWidgetResolvedField {
  key: string;
  title: string;
  value: string;
  width: CollectionWidgetFieldWidth;
  hideWhenEmpty: boolean;
}

interface CollectionWidgetCardData {
  title: string;
  fields: {[key: string]: string};
  hidden?: boolean;
}

interface WidgetTableContent {
  columns: FieldsWidgetValue[];
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
  CollectionWidgetField,
  CollectionWidgetFieldWidth,
  CollectionWidgetResolvedField,
  CollectionWidgetTitle,
  CollectionWidgetCardData,
};
