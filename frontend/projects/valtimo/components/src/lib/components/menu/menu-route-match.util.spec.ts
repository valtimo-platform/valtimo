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

import {getMenuLinkMatchScore} from './menu-route-match.util';

describe('getMenuLinkMatchScore', () => {
  it('matches the link itself', () => {
    expect(getMenuLinkMatchScore('/cases/verhuizing', '/cases/verhuizing')).toBe(
      '/cases/verhuizing'.length
    );
  });

  it('matches routes below the link', () => {
    expect(getMenuLinkMatchScore('/cases/verhuizing/document/123', '/cases/verhuizing')).toBe(
      '/cases/verhuizing'.length
    );
  });

  it('does not match a key that only starts with the link', () => {
    expect(getMenuLinkMatchScore('/cases/verhuizing-dossier', '/cases/verhuizing')).toBe(0);
    expect(getMenuLinkMatchScore('/cases/bezwaar-beroep', '/cases/bezwaar')).toBe(0);
  });

  it('scores a longer link higher than its section', () => {
    const url = '/cases/verhuizing';

    expect(getMenuLinkMatchScore(url, '/cases/verhuizing')).toBeGreaterThan(
      getMenuLinkMatchScore(url, '/cases')
    );
  });

  it('does not match the link in the middle of the url', () => {
    expect(getMenuLinkMatchScore('/admin/tasks', '/tasks')).toBe(0);
  });

  it('ignores query string and fragment', () => {
    expect(getMenuLinkMatchScore('/cases/verhuizing?page=2', '/cases/verhuizing')).toBeGreaterThan(
      0
    );
    expect(getMenuLinkMatchScore('/cases/verhuizing#top', '/cases/verhuizing')).toBeGreaterThan(0);
    expect(getMenuLinkMatchScore('/cases/verhuizing-dossier?x=1', '/cases/verhuizing')).toBe(0);
  });

  it('ignores case, encoding, and extra slashes', () => {
    expect(getMenuLinkMatchScore('/Cases/Mijn%20Zaak/', '/cases/mijn zaak')).toBeGreaterThan(0);
    expect(getMenuLinkMatchScore('/cases//verhuizing', 'cases/verhuizing')).toBeGreaterThan(0);
  });

  it('matches the root link only on the root route', () => {
    expect(getMenuLinkMatchScore('/', '/')).toBe(1);
    expect(getMenuLinkMatchScore('/?tab=1', '/')).toBe(1);
    expect(getMenuLinkMatchScore('/tasks', '/')).toBe(0);
  });
});
