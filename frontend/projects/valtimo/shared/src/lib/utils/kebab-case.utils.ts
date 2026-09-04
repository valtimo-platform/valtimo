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

const DIACRITIC_MARKS_REGEX = /[\u0300-\u036f]/g;
const DISALLOWED_REGEX = /[^a-z0-9-_]+|-[^a-z0-9]+/g;
const UNDERSCORE_RUN_REGEX = /_[-_]+/g;
const LEADING_NON_LETTER_REGEX = /^[^a-z]+/;
const TRAILING_SEPARATOR_REGEX = /[-_]+$/;

/**
 * Derives a key/identifier from human readable text.
 *
 * The result is safe to use as an XML/BPMN id: lowercase, no whitespace, and
 * always starting with a letter.
 */
const toKebabCase = (source: string, maxLength?: number): string => {
  if (!source) return '';

  const kebab = source
    .normalize('NFD')
    .replace(DIACRITIC_MARKS_REGEX, '')
    .toLowerCase()
    .replace(DISALLOWED_REGEX, '-')
    .replace(UNDERSCORE_RUN_REGEX, '_')
    .replace(LEADING_NON_LETTER_REGEX, '')
    .replace(TRAILING_SEPARATOR_REGEX, '');

  if (!maxLength || kebab.length <= maxLength) return kebab;

  return truncateOnWordBoundary(kebab, maxLength);
};

const truncateOnWordBoundary = (kebab: string, maxLength: number): string => {
  const truncated = kebab.slice(0, maxLength);
  const lastSeparator = truncated.lastIndexOf('-');
  // Only cut on a word boundary when it does not swallow most of the text
  const onBoundary = lastSeparator > maxLength / 2;

  return (onBoundary ? truncated.slice(0, lastSeparator) : truncated).replace(
    TRAILING_SEPARATOR_REGEX,
    ''
  );
};

export {toKebabCase};
