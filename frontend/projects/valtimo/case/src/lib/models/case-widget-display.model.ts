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

enum CaseWidgetDisplayTypeKey {
  TEXT = 'text',
  BOOLEAN = 'boolean',
  CURRENCY = 'currency',
  DATE = 'date',
  DATE_TIME = 'datetime',
  ENUM = 'enum',
  NUMBER = 'number',
  PERCENT = 'percent',
}

interface CaseWidgetTextDisplayType {
  type: CaseWidgetDisplayTypeKey.TEXT;
  ellipsisCharacterLimit: number;
  hideWhenEmpty: boolean;
}

interface CaseWidgetBooleanDisplayType {
  type: CaseWidgetDisplayTypeKey.BOOLEAN;
  hideWhenEmpty: boolean;
}

interface CaseWidgetCurrencyDisplayType {
  type: CaseWidgetDisplayTypeKey.CURRENCY;
  currencyCode?: string;
  display?: string;
  digitsInfo?: string;
  hideWhenEmpty: boolean;
}

interface CaseWidgetDateDisplayType {
  type: CaseWidgetDisplayTypeKey.DATE;
  format?: string;
  hideWhenEmpty: boolean;
}

interface CaseWidgetDateTimeDisplayType {
  type: CaseWidgetDisplayTypeKey.DATE_TIME;
  format?: string;
  hideWhenEmpty: boolean;
}

interface CaseWidgetEnumDisplayType {
  type: CaseWidgetDisplayTypeKey.ENUM;
  values: {
    [key: string]: string;
  };
  hideWhenEmpty: boolean;
}

interface CaseWidgetNumberDisplayType {
  type: CaseWidgetDisplayTypeKey.NUMBER;
  digitsInfo?: string;
  hideWhenEmpty: boolean;
}

interface CaseWidgetPercentDisplayType {
  type: CaseWidgetDisplayTypeKey.PERCENT;
  digitsInfo?: string;
  hideWhenEmpty: boolean;
}

type CaseWidgetDisplayType =
  | CaseWidgetTextDisplayType
  | CaseWidgetBooleanDisplayType
  | CaseWidgetCurrencyDisplayType
  | CaseWidgetDateDisplayType
  | CaseWidgetDateTimeDisplayType
  | CaseWidgetEnumDisplayType
  | CaseWidgetNumberDisplayType
  | CaseWidgetPercentDisplayType;

export {
  CaseWidgetBooleanDisplayType,
  CaseWidgetCurrencyDisplayType,
  CaseWidgetDateDisplayType,
  CaseWidgetDateTimeDisplayType,
  CaseWidgetDisplayType,
  CaseWidgetDisplayTypeKey,
  CaseWidgetEnumDisplayType,
  CaseWidgetNumberDisplayType,
  CaseWidgetPercentDisplayType,
  CaseWidgetTextDisplayType,
};
