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

const STOPWORDS = new Set([
  'van',
  'de',
  'het',
  'een',
  'en',
  'voor',
  'der',
  'in',
  'op',
  'aan',
  'met',
]);
const PALETTE_SIZE = 6;
const MAX_INITIALS = 4;
const MIN_INITIALS = 3;

/** Initials of up to 4 meaningful words, padded from the last word to at least 3 characters. */
const monogramInitials = (title: string | null | undefined): string => {
  const words = (title ?? '')
    .split(/\s+/)
    .map(word => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
  if (!words.length) return '?';

  const significant = words.filter(word => !STOPWORDS.has(word.toLowerCase()));
  const used = significant.length ? significant : words;
  let initials = used
    .slice(0, MAX_INITIALS)
    .map(word => word[0])
    .join('');
  const last = used[Math.min(used.length, MAX_INITIALS) - 1] ?? '';

  for (let i = 1; initials.length < MIN_INITIALS && i < last.length; i++) initials += last[i];

  return initials.toUpperCase().slice(0, MAX_INITIALS);
};

/** Deterministic palette index (0-5) per title. */
const monogramColorIndex = (title: string | null | undefined): number => {
  const hash = [...(title ?? '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 7);
  return hash % PALETTE_SIZE;
};

export {monogramColorIndex, monogramInitials};
