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

interface IsoDurationParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

type IsoDurationUnit = keyof IsoDurationParts;

const ISO_DURATION_PATTERN =
  /^P(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

/**
 * Parses the day/time subset of ISO-8601 durations (`PnW`, `PnD`, `PTnHnMnS`) that contract
 * operation timeouts use. Calendar units (years, months) have no fixed length and yield null.
 */
function parseIsoDuration(value: string | null | undefined): IsoDurationParts | null {
  const normalized = value?.trim().toUpperCase() ?? '';
  const match = normalized.match(ISO_DURATION_PATTERN);
  // Bare `P` or a dangling `T` carry no amount
  if (!match || normalized === 'P' || normalized.endsWith('T')) return null;
  const [weeks, days, hours, minutes, seconds] = match
    .slice(1)
    .map(part => (part ? Number(part) : 0));
  return {days: weeks * 7 + days, hours, minutes, seconds};
}

/** Non-zero units in display order. */
function isoDurationUnits(parts: IsoDurationParts): Array<{unit: IsoDurationUnit; value: number}> {
  return (['days', 'hours', 'minutes', 'seconds'] as Array<IsoDurationUnit>)
    .filter(unit => parts[unit] > 0)
    .map(unit => ({unit, value: parts[unit]}));
}

export {IsoDurationParts, IsoDurationUnit, parseIsoDuration, isoDurationUnits};
