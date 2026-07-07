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

// A permission condition value is generically typed on the backend (a string, number, boolean,
// null, list or object). The form editor edits it through a single text field, so we need a
// lossless-as-possible bridge between the stored value and its text representation.

/**
 * Render a stored condition value as editable text.
 * - undefined -> empty string (no value set, e.g. a freshly-added condition)
 * - null -> the literal "null" (so an intentional null reads as deliberate rather than an unfilled
 *   field, and still round-trips back to null through textToValue)
 * - string -> the raw string (so '${currentUserId}' and 'someKey' show without quotes)
 * - everything else (number, boolean, array, object) -> its JSON representation
 */
function valueToText(value: unknown): string {
  if (value === undefined) return '';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/**
 * Parse editable text back into a stored condition value.
 * - empty string -> null
 * - valid JSON (number, boolean, null, array, object, quoted string) -> the parsed value
 * - anything else -> the raw string (so 'view' or '${currentUserId}' stay strings)
 */
function textToValue(text: string): unknown {
  const trimmed = (text ?? '').trim();
  if (trimmed === '') return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return text;
  }
}

export {textToValue, valueToText};
