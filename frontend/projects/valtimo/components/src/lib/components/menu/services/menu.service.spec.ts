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

import {MenuItem} from '@valtimo/shared';
import {BehaviorSubject, EMPTY, firstValueFrom} from 'rxjs';
import {MenuService} from './menu.service';

describe('MenuService', () => {
  const menuItems: MenuItem[] = [
    {title: 'Dashboard', link: ['/'], sequence: 0},
    {title: 'Cases', link: ['/cases'], sequence: 1},
    {
      title: 'Admin',
      sequence: 2,
      children: [
        {title: 'Memory', link: ['/plugin-pages', 'cfg-1', 'key'], sequence: 0},
        {title: 'Other page', link: ['/plugin-pages', 'cfg-1'], sequence: 1},
      ],
    },
  ] as MenuItem[];

  let service: MenuService;

  beforeEach(() => {
    service = new MenuService(
      {config: {}} as any,
      null as any,
      null as any,
      null as any,
      {pendingChanges: false} as any,
      {events: EMPTY} as any,
      null as any,
      null as any
    );
    (service as unknown as {_menuItems$: BehaviorSubject<MenuItem[]>})._menuItems$.next(menuItems);
  });

  const titleFor = (url: string) => firstValueFrom(service.getMenuItemTitleForUrl(url));

  it('returns the title of a matching top-level item', async () => {
    expect(await titleFor('/cases/bezwaar')).toBe('Cases');
  });

  it('returns the title of a matching child item', async () => {
    expect(await titleFor('/plugin-pages/cfg-1/key')).toBe('Memory');
  });

  it('prefers the most specific matching link', async () => {
    expect(await titleFor('/plugin-pages/cfg-1')).toBe('Other page');
    expect(await titleFor('/plugin-pages/cfg-1/key')).toBe('Memory');
  });

  it('returns null when no item matches', async () => {
    expect(await titleFor('/plugin-pages/unknown')).toBeNull();
  });

  it('waits for the menu to be built before resolving a title', async () => {
    const menuItems$ = (service as unknown as {_menuItems$: BehaviorSubject<MenuItem[]>})
      ._menuItems$;
    menuItems$.next([]);
    const title = titleFor('/plugin-pages/cfg-1/key');
    menuItems$.next(menuItems);
    expect(await title).toBe('Memory');
  });
});
