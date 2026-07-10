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

import {IncludeFunction, MenuItem, ROLE_ADMIN, ROLE_USER} from '@valtimo/shared';
import {MenuConfiguration} from './menu-configuration.model';
import {resolveMenuConfiguration} from './menu-configuration.resolver';
import {buildMenuConfigurationFromRuntimeMenu} from './menu-configuration.seed';

describe('menu configuration resolver', () => {
  it('fills catalog defaults for a bare catalog node', () => {
    const config: MenuConfiguration = {version: 1, items: [{kind: 'catalog', itemId: 'dashboard'}]};

    const [dashboard] = resolveMenuConfiguration(config);

    expect(dashboard).toEqual({
      title: 'Dashboard',
      roles: [ROLE_USER],
      link: ['/'],
      iconClass: 'icon mdi mdi-view-dashboard',
    });
  });

  it('applies title and icon overrides over the catalog default', () => {
    const config: MenuConfiguration = {
      version: 1,
      items: [{kind: 'catalog', itemId: 'tasks', title: 'My tasks', icon: 'icon mdi mdi-star'}],
    };

    const [tasks] = resolveMenuConfiguration(config);

    expect(tasks.title).toBe('My tasks');
    expect(tasks.iconClass).toBe('icon mdi mdi-star');
    expect(tasks.link).toEqual(['/tasks']);
  });

  it('lets a preserved roles set win over the catalog default', () => {
    const config: MenuConfiguration = {
      version: 1,
      items: [{kind: 'catalog', itemId: 'tasks', roles: [ROLE_ADMIN]}],
    };

    const [tasks] = resolveMenuConfiguration(config);

    expect(tasks.roles).toEqual([ROLE_ADMIN]);
  });

  it('resolves each non-catalog kind', () => {
    const config: MenuConfiguration = {
      version: 1,
      items: [
        {kind: 'section-header', title: 'Group'},
        {kind: 'custom-link', title: 'External', link: '/external', icon: 'icon mdi mdi-link'},
        {
          kind: 'plugin-page',
          configurationId: 'abc-123',
          bundleKey: 'overview',
          title: 'Overview',
          icon: 'icon mdi mdi-home',
        },
      ],
    };

    const [header, custom, page] = resolveMenuConfiguration(config);

    expect(header).toEqual({title: 'Group', textClass: 'text-dark font-weight-bold c-default'});
    expect(custom).toEqual({
      title: 'External',
      roles: [ROLE_USER],
      link: ['/external'],
      iconClass: 'icon mdi mdi-link',
    });
    expect(page.link).toEqual(['/plugin-pages', 'abc-123', 'overview']);
  });

  it('resolves a custom section (group) into a submenu with resolved children', () => {
    const config: MenuConfiguration = {
      version: 1,
      items: [
        {
          kind: 'group',
          title: 'My section',
          icon: 'icon mdi mdi-folder',
          children: [{kind: 'custom-link', title: 'Docs', link: '/docs'}],
        },
      ],
    };

    const [group] = resolveMenuConfiguration(config);

    expect(group.title).toBe('My section');
    expect(group.iconClass).toBe('icon mdi mdi-folder');
    expect(group.link).toBeUndefined();
    expect(group.children).toEqual([
      {title: 'Docs', roles: [ROLE_USER], link: ['/docs']},
    ]);
  });

  it('resolves a plugin-page without a bundle key to a two-segment route', () => {
    const config: MenuConfiguration = {
      version: 1,
      items: [{kind: 'plugin-page', configurationId: 'abc-123', title: 'Overview'}],
    };

    const [page] = resolveMenuConfiguration(config);

    expect(page.link).toEqual(['/plugin-pages', 'abc-123']);
  });

  it('skips an unknown catalog itemId with a warning', () => {
    spyOn(console, 'warn');
    const config: MenuConfiguration = {
      version: 1,
      items: [{kind: 'catalog', itemId: 'does-not-exist'}, {kind: 'catalog', itemId: 'tasks'}],
    };

    const resolved = resolveMenuConfiguration(config);

    expect(console.warn).toHaveBeenCalled();
    // tasks survives, plus the auto-injected required Admin item
    expect(resolved.some(item => item.title === 'Tasks')).toBeTrue();
    expect(resolved.some(item => item.title === 'does-not-exist')).toBeFalse();
  });

  it('forces the required Admin + Settings items present when the saved config omits them', () => {
    const config: MenuConfiguration = {version: 1, items: [{kind: 'catalog', itemId: 'dashboard'}]};

    const resolved = resolveMenuConfiguration(config);

    const admin = resolved.find(item => item.title === 'Admin');
    expect(admin).toBeDefined();
    expect(admin?.children?.some(child => (child.link ?? []).join('') === '/admin-settings')).toBeTrue();
  });

  it('strips an include function from a required item so it can never be hidden at runtime', () => {
    const config: MenuConfiguration = {
      version: 1,
      items: [
        {kind: 'catalog', itemId: 'adminSettings', includeFunction: IncludeFunction.ObjectManagementEnabled},
      ],
    };

    const [settings] = resolveMenuConfiguration(config);

    expect(settings.title).toBe('adminSettings.title');
    expect(settings.includeFunction).toBeUndefined();
  });

  it('does not duplicate Settings when it has been moved out of Admin to the top level', () => {
    const config: MenuConfiguration = {
      version: 1,
      items: [
        {kind: 'catalog', itemId: 'adminSettings'},
        {kind: 'catalog', itemId: 'admin', children: []},
      ],
    };

    const resolved = resolveMenuConfiguration(config);

    const countLink = (items: MenuItem[]): number =>
      items.reduce(
        (total, item) =>
          total +
          ((item.link ?? []).join('') === '/admin-settings' ? 1 : 0) +
          (item.children ? countLink(item.children) : 0),
        0
      );
    expect(countLink(resolved)).toBe(1);
  });
});

describe('menu configuration reverse-seed mapper', () => {
  it('round-trips the live runtime menu through seed + resolve', () => {
    const menu: MenuItem[] = [
      {roles: [ROLE_USER], link: ['/'], title: 'Dashboard', iconClass: 'icon mdi mdi-view-dashboard'},
      {roles: [ROLE_USER], title: 'Cases', iconClass: 'icon mdi mdi-layers', children: []},
      {
        roles: [ROLE_ADMIN],
        title: 'Objects',
        iconClass: 'icon mdi mdi-archive',
        includeFunction: IncludeFunction.ObjectManagementEnabled,
      },
      {
        roles: [ROLE_ADMIN],
        title: 'Admin',
        iconClass: 'icon mdi mdi-tune',
        children: [
          {title: 'Configuration', textClass: 'text-dark font-weight-bold c-default'},
          {roles: [ROLE_ADMIN], link: ['/admin-settings'], title: 'adminSettings.title'},
          {
            roles: [ROLE_ADMIN],
            link: ['/my-custom-admin-page'],
            title: 'My Custom Admin Page',
            iconClass: 'icon mdi mdi-star',
          },
        ],
      },
      {roles: [ROLE_USER], link: ['/my-downstream-link'], title: 'Downstream', iconClass: 'icon mdi mdi-link'},
    ];

    const resolved = resolveMenuConfiguration(buildMenuConfigurationFromRuntimeMenu(menu));

    expect(resolved).toEqual(menu);
  });

  it('captures a custom top-level section (no link, with children) as a group node, round-tripping', () => {
    const section: MenuItem = {
      roles: [ROLE_USER],
      title: 'My section',
      iconClass: 'icon mdi mdi-folder',
      children: [
        {roles: [ROLE_USER], link: ['/docs'], title: 'Docs', iconClass: 'icon mdi mdi-book'},
      ],
    };

    const config = buildMenuConfigurationFromRuntimeMenu([section]);

    expect(config.items[0].kind).toBe('group');
    // The section itself round-trips; the resolver additionally appends the required Admin item
    // (this menu omits it), which the required-item test covers separately.
    expect(resolveMenuConfiguration(config)[0]).toEqual(section);
  });

  it('captures an unmatched link as a custom-link node preserving custom roles', () => {
    const menu: MenuItem[] = [
      {roles: ['ROLE_SPECIAL'], link: ['/secret'], title: 'Secret', iconClass: 'icon mdi mdi-lock'},
    ];

    const config = buildMenuConfigurationFromRuntimeMenu(menu);

    expect(config.items[0]).toEqual({
      kind: 'custom-link',
      title: 'Secret',
      link: '/secret',
      icon: 'icon mdi mdi-lock',
      roles: ['ROLE_SPECIAL'],
    });
  });
});
