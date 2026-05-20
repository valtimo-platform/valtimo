/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

import {TranslateService} from '@ngx-translate/core';
import {
  FIELD_LABEL,
  OPERATOR_LABEL,
  RESOURCE_TYPE_LABEL,
  SPECIAL_VALUE_LABEL,
} from '../constants';
import {ConditionOperator} from '../models';

function formatResourceType(translate: TranslateService, fqn: string): string {
  const key = RESOURCE_TYPE_LABEL[fqn];
  if (key) return translate.instant(key);
  const segments = fqn.split('.');
  return segments[segments.length - 1] || fqn;
}

function formatField(translate: TranslateService, resourceType: string, field: string): string {
  const key = FIELD_LABEL[resourceType]?.[field];
  if (key) return translate.instant(key);
  return humanizeFieldPath(field);
}

function formatOperator(translate: TranslateService, operator: ConditionOperator): string {
  const key = OPERATOR_LABEL[operator];
  return key ? translate.instant(key) : operator;
}

function formatValue(translate: TranslateService, value: unknown): string {
  if (value === null) {
    return translate.instant('accessControl.overview.specialValues.null');
  }
  if (typeof value === 'string') {
    if (value === '') return translate.instant('accessControl.overview.specialValues.empty');
    const specialKey = SPECIAL_VALUE_LABEL[value];
    if (specialKey) return translate.instant(specialKey);
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(item => formatValue(translate, item)).join(', ');
  }
  return String(value);
}

function humanizeFieldPath(field: string): string {
  return field
    .split('.')
    .map(part => part.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase())
    .join(' ');
}

function isFieldLabelKnown(resourceType: string, field: string): boolean {
  return !!FIELD_LABEL[resourceType]?.[field];
}

function isResourceTypeKnown(fqn: string): boolean {
  return !!RESOURCE_TYPE_LABEL[fqn];
}

export {
  formatField,
  formatOperator,
  formatResourceType,
  formatValue,
  humanizeFieldPath,
  isFieldLabelKnown,
  isResourceTypeKnown,
};
