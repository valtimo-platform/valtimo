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

import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {RouterTestingModule} from '@angular/router/testing';
import {PageTitleComponent} from './page-title.component';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {MockTranslateService, VALTIMO_CONFIG} from '@valtimo/shared';
import {LoggerTestingModule} from 'ngx-logger/testing';
import {environment} from '@src/environments/environment';
import {ActivatedRoute, NavigationEnd, Router} from '@angular/router';
import {Title} from '@angular/platform-browser';
import {of, Subject} from 'rxjs';

describe('PageTitleComponent', () => {
  let component: PageTitleComponent;
  let fixture: ComponentFixture<PageTitleComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule, LoggerTestingModule],
      declarations: [PageTitleComponent],
      providers: [
        {provide: TranslateService, useClass: MockTranslateService},
        {provide: VALTIMO_CONFIG, useValue: environment},
        {
          provide: ActivatedRoute,
          useValue: {
            firstChild: {
              data: of({id: ''}),
            },
          },
        },
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PageTitleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have Valtimo as appTitle', () => {
    expect(component.appTitle).toEqual('Valtimo');
  });
});

describe('PageTitleComponent with real translations', () => {
  let component: PageTitleComponent;
  let fixture: ComponentFixture<PageTitleComponent>;
  let router: Router;
  let titleService: Title;
  let snapshot: {firstChild: {data: {title?: string}; children: Array<unknown>} | null};

  beforeEach(waitForAsync(() => {
    snapshot = {firstChild: {data: {title: 'Dashboard'}, children: []}};

    TestBed.configureTestingModule({
      imports: [RouterTestingModule, LoggerTestingModule, TranslateModule.forRoot()],
      declarations: [PageTitleComponent],
      providers: [
        {provide: VALTIMO_CONFIG, useValue: environment},
        {
          provide: ActivatedRoute,
          useValue: {
            firstChild: {data: of({})},
            get snapshot() {
              return snapshot;
            },
          },
        },
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    router = TestBed.inject(Router);
    titleService = TestBed.inject(Title);
    fixture = TestBed.createComponent(PageTitleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('clears the previous title when the next route has no title', () => {
    expect(component.translatedTitle$.getValue()).toBe('Dashboard');
    expect(titleService.getTitle()).toContain('Dashboard');

    snapshot.firstChild = {data: {}, children: []};
    (router.events as Subject<unknown>).next(
      new NavigationEnd(1, '/plugin-pages/a', '/plugin-pages/a')
    );

    expect(component.translatedTitle$.getValue()).toBe('');
    expect(titleService.getTitle()).toBe('Valtimo');
  });
});
