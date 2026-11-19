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

// Mirrors ValueResolverServiceImpl.hasPrefix on the backend
const RESOLVER_PREFIX_PATTERN = /^[A-Za-z_-]+$/;
const RESOLVER_DELIMITER = ':';
const HTTP_PROTOCOLS = ['http:', 'https:'];

/**
 * A document reference is either a resolver expression with a registered prefix and a non-empty
 * path (e.g. `pv:documentUrl`), or an absolute HTTP(S) URL. Any other value is passed to the
 * backend as a literal and cannot identify a document.
 */
export function isValidDocumentReference(
  value: string | null | undefined,
  resolverPrefixes: string[]
): boolean {
  const reference = value?.trim();
  if (!reference) return false;

  const delimiterIndex = reference.indexOf(RESOLVER_DELIMITER);
  const prefix = delimiterIndex > 0 ? reference.substring(0, delimiterIndex) : '';

  if (RESOLVER_PREFIX_PATTERN.test(prefix) && resolverPrefixes.includes(prefix)) {
    return reference.substring(delimiterIndex + 1).trim().length > 0;
  }

  return isAbsoluteHttpUrl(reference);
}

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return HTTP_PROTOCOLS.includes(url.protocol) && url.hostname.length > 0;
  } catch {
    return false;
  }
}
