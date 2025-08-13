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

enum WidgetDisplayTypeKey {
  TEXT = 'text',
  BOOLEAN = 'boolean',
  CURRENCY = 'currency',
  DATE = 'date',
  DATE_TIME = 'datetime',
  ENUM = 'enum',
  NUMBER = 'number',
  PERCENT = 'percent',
}

interface WidgetTextDisplayType {
  type: WidgetDisplayTypeKey.TEXT;
  ellipsisCharacterLimit: number;
  hideWhenEmpty: boolean;
}

interface WidgetBooleanDisplayType {
  type: WidgetDisplayTypeKey.BOOLEAN;
  hideWhenEmpty: boolean;
}

interface WidgetCurrencyDisplayType {
  type: WidgetDisplayTypeKey.CURRENCY;
  currencyCode?: string;
  display?: string;
  digitsInfo?: string;
  hideWhenEmpty: boolean;
}

interface WidgetDateDisplayType {
  type: WidgetDisplayTypeKey.DATE;
  format?: string;
  hideWhenEmpty: boolean;
}

interface WidgetDateTimeDisplayType {
  type: WidgetDisplayTypeKey.DATE_TIME;
  format?: string;
  hideWhenEmpty: boolean;
}

interface WidgetEnumDisplayType {
  type: WidgetDisplayTypeKey.ENUM;
  values: {
    [key: string]: string;
  };
  hideWhenEmpty: boolean;
}

interface WidgetNumberDisplayType {
  type: WidgetDisplayTypeKey.NUMBER;
  digitsInfo?: string;
  hideWhenEmpty: boolean;
}

interface WidgetPercentDisplayType {
  type: WidgetDisplayTypeKey.PERCENT;
  digitsInfo?: string;
  hideWhenEmpty: boolean;
}

type WidgetDisplayType =
  | WidgetTextDisplayType
  | WidgetBooleanDisplayType
  | WidgetCurrencyDisplayType
  | WidgetDateDisplayType
  | WidgetDateTimeDisplayType
  | WidgetEnumDisplayType
  | WidgetNumberDisplayType
  | WidgetPercentDisplayType;

export {
  WidgetBooleanDisplayType,
  WidgetCurrencyDisplayType,
  WidgetDateDisplayType,
  WidgetDateTimeDisplayType,
  WidgetDisplayType,
  WidgetDisplayTypeKey,
  WidgetEnumDisplayType,
  WidgetNumberDisplayType,
  WidgetPercentDisplayType,
  WidgetTextDisplayType,
};
