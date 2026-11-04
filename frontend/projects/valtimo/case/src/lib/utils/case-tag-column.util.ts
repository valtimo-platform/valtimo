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

import {CarbonTag} from '@valtimo/components';
import {CaseTag, CaseTagsUtils} from '@valtimo/document';

/**
 * Converts the case tags in a tags column value to Carbon tags. Anything else, such as plain strings
 * from a document path or values that already are Carbon tags, is left for the list to render as is.
 */
export function mapCaseTagColumnValue(value: unknown): unknown {
  if (!Array.isArray(value)) return value;

  return value.map(tag => (isCaseTag(tag) ? toCarbonTag(tag) : tag));
}

function isCaseTag(value: unknown): value is CaseTag {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as CaseTag).title === 'string' &&
    !!(value as CaseTag).color
  );
}

function toCarbonTag(caseTag: CaseTag): CarbonTag {
  return {
    content: caseTag.title,
    type: CaseTagsUtils.getTagTypeFromCaseTagColor(caseTag.color),
  };
}
