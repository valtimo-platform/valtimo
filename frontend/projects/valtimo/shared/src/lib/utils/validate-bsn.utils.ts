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

const validateBsn = (value: string): boolean => {
  if (!value) return false;

  const trimmed = value.toString().trim();

  if (!/^\d+$/.test(trimmed)) return false;

  if (trimmed.length < 8 || trimmed.length > 9) return false;

  if (/^0+$/.test(trimmed) || /^9+$/.test(trimmed)) return false;

  const digits = trimmed.split('').map(d => parseInt(d, 10));
  let sum = 0;
  const length = digits.length;

  for (let i = 0; i < length; i++) {
    const weight = i === length - 1 ? -1 : length - i;
    sum += digits[i] * weight;
  }

  return sum % 11 === 0;
};

export { validateBsn };
