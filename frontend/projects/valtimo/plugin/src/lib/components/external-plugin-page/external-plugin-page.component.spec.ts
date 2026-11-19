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

import {TestBed} from '@angular/core/testing';
import {ActivatedRoute, Router} from '@angular/router';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {MenuService, PageTitleService} from '@valtimo/components';
import {BehaviorSubject, Observable, of, Subject} from 'rxjs';
import {ExternalPluginPageService, ExternalPluginSessionService} from '../../services';
import {ExternalPluginPageComponent} from './external-plugin-page.component';

describe('ExternalPluginPageComponent page title', () => {
  const page = {
    configurationId: 'cfg-1',
    bundleKey: 'key',
    bundleUrl: 'http://plugin/bundle.js',
    configurationTitle: 'Config title',
  };
  let menuTitle: string | null;
  let menuTitle$: Observable<string | null> | null;
  let pages: Array<typeof page>;
  let setCustomPageTitle: jasmine.Spy;

  const create = (): void => {
    TestBed.createComponent(ExternalPluginPageComponent).detectChanges();
  };

  beforeEach(() => {
    menuTitle = null;
    menuTitle$ = null;
    pages = [page];
    setCustomPageTitle = jasmine.createSpy('setCustomPageTitle');

    TestBed.configureTestingModule({
      imports: [ExternalPluginPageComponent, TranslateModule.forRoot()],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {params: new BehaviorSubject({configurationId: 'cfg-1', bundleKey: 'key'})},
        },
        {provide: Router, useValue: {url: '/plugin-pages/cfg-1/key'}},
        {provide: ExternalPluginPageService, useValue: {getMenuPages: () => of(pages)}},
        {
          provide: MenuService,
          useValue: {getMenuItemTitleForUrl: () => menuTitle$ ?? of(menuTitle)},
        },
        {provide: PageTitleService, useValue: {setCustomPageTitle}},
      ],
    }).overrideComponent(ExternalPluginPageComponent, {
      set: {
        providers: [
          {provide: ExternalPluginSessionService, useValue: {startSession: () => of(null)}},
        ],
        template: '',
      },
    });
  });

  it('uses the menu item title as page title', () => {
    menuTitle = 'Memory';
    create();
    expect(setCustomPageTitle.calls.mostRecent().args[0]).toBe('Memory');
  });

  it('translates a menu item title that is a translation key', () => {
    menuTitle = 'pages.memory.title';
    TestBed.inject(TranslateService).setTranslation('en', {pages: {memory: {title: 'Memory'}}});
    TestBed.inject(TranslateService).use('en');
    create();
    expect(setCustomPageTitle.calls.mostRecent().args[0]).toBe('Memory');
  });

  it('falls back to the configuration title without a matching menu item', () => {
    create();
    expect(setCustomPageTitle.calls.mostRecent().args[0]).toBe('Config title');
  });

  it('still sets a title when the page cannot be loaded', () => {
    pages = [];
    menuTitle = 'Memory';
    create();
    expect(setCustomPageTitle.calls.mostRecent().args[0]).toBe('Memory');
  });

  it('sets an empty title without menu item when the page cannot be loaded', () => {
    pages = [];
    create();
    expect(setCustomPageTitle.calls.mostRecent().args[0]).toBe('');
  });

  it('shows the configuration title until the menu is built, then the menu item title', () => {
    const lateMenuTitle$ = new Subject<string | null>();
    menuTitle$ = lateMenuTitle$;
    create();
    expect(setCustomPageTitle.calls.mostRecent().args[0]).toBe('Config title');

    lateMenuTitle$.next('Memory');
    expect(setCustomPageTitle.calls.mostRecent().args[0]).toBe('Memory');
  });
});
