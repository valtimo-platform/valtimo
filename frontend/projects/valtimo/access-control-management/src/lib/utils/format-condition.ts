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
import {OPERATOR_LABEL} from '../constants';
import {ConditionOperator} from '../models';

const SPECIAL_VALUE_PATTERN = /^\$\{([A-Za-z_$][A-Za-z0-9_$]*)\}$/;

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function upperFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function resourceTypeI18nKey(fqn: string): string | null {
  const lastSegment = fqn.split('.').pop();
  if (!lastSegment) return null;
  return `accessControl.resourceTypes.${lowerFirst(lastSegment)}`;
}

function fieldI18nKey(resourceType: string, field: string): string | null {
  const resourceSegment = resourceType.split('.').pop();
  if (!resourceSegment || !field) return null;
  const fieldSegment = field
    .split('.')
    .map((part, i) => (i === 0 ? part : upperFirst(part)))
    .join('');
  return `accessControl.overview.fields.${lowerFirst(resourceSegment)}.${fieldSegment}`;
}

function tryTranslate(translate: TranslateService, key: string): string | null {
  const translated = translate.instant(key);
  return translated === key ? null : translated;
}

function formatResourceType(translate: TranslateService, fqn: string): string {
  const key = resourceTypeI18nKey(fqn);
  const translated = key ? tryTranslate(translate, key) : null;
  if (translated !== null) return translated;
  const segments = fqn.split('.');
  return segments[segments.length - 1] || fqn;
}

function formatField(translate: TranslateService, resourceType: string, field: string): string {
  const key = fieldI18nKey(resourceType, field);
  const translated = key ? tryTranslate(translate, key) : null;
  if (translated !== null) return translated;
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
    const match = SPECIAL_VALUE_PATTERN.exec(value);
    if (match) {
      const key = `accessControl.overview.specialValues.${match[1]}`;
      const translated = tryTranslate(translate, key);
      if (translated !== null) return translated;
    }
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

export {formatField, formatOperator, formatResourceType, formatValue, humanizeFieldPath};
