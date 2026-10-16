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

// The root route normalizes to ''.
const normalizeMenuPath = (value: string): string =>
  (
    '/' +
    decodeURIComponent(value.split(/[?#]/)[0])
      .toLowerCase()
      .replace(/\/{2,}/g, '/')
      .replace(/^\/+/, '')
  ).replace(/\/+$/, '');

/**
 * How well a menu link matches the current url: the length of the link when the url is the link
 * itself or lies below it, 0 otherwise. Matches whole path segments, so `/cases/a` does not match
 * `/cases/a-b`.
 */
const getMenuLinkMatchScore = (currentUrl: string, link: string): number => {
  const current = normalizeMenuPath(currentUrl);
  const normalizedLink = normalizeMenuPath(link);

  // The root link would prefix every url; only the root route is its own.
  if (normalizedLink === '') return current === '' ? 1 : 0;

  return current === normalizedLink || current.startsWith(normalizedLink + '/')
    ? normalizedLink.length
    : 0;
};

export {getMenuLinkMatchScore};
