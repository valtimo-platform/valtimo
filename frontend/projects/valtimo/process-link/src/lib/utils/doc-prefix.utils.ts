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

const DOC_PREFIX = 'doc:/';

export function ensureDocPrefix(value: string): string {
  if (!value) return value;
  const colonIndex = value.indexOf(':');
  if (colonIndex > -1 && !value.startsWith('doc:')) return value;
  let path = value;
  if (path.startsWith('doc:/')) path = path.substring(5);
  else if (path.startsWith('doc:')) path = path.substring(4);
  if (path.startsWith('/')) path = path.substring(1);
  return `${DOC_PREFIX}${path.replace(/\./g, '/')}`;
}
