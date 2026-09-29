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

/** How offset-less text reads: local for the picker, UTC for a plan value — as the server reads it. */
type NaiveAs = 'local' | 'utc';

const OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i;

const asDate = (value: unknown, naiveAs: NaiveAs): Date | null => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return null;
  const parsed = new Date(naiveAs === 'utc' && !OFFSET.test(text) ? `${text}Z` : text);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** A value as a true instant. Second precision, so the echo check matches its own emission. */
const asInstant = (value: unknown, naiveAs: NaiveAs): string | null => {
  const parsed = asDate(value, naiveAs);

  return parsed ? `${parsed.toISOString().slice(0, 19)}Z` : null;
};

/** A plan's instant trimmed to the `YYYY-MM-DDTHH:mm` the datetime-local input accepts — a full instant renders blank. */
export const toDateTimeLocal = (value: unknown): string => {
  const parsed = asDate(value, 'utc');
  if (!parsed) return '';

  const pad = (part: number): string => `${part}`.padStart(2, '0');

  return (
    `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}` +
    `T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
  );
};

/** The picker's value as an instant, or [loaded] while the picker still shows its minute — the picker has no seconds. */
export const pickedInstant = (pickerValue: unknown, loaded: string | null): string | null => {
  const picked = asInstant(pickerValue, 'local');

  return picked && loaded && picked.slice(0, 16) === loaded.slice(0, 16) ? loaded : picked;
};

/** A plan's `scheduledAtDate` as an instant. */
export const planInstant = (value: unknown): string | null => asInstant(value, 'utc');
