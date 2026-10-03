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
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, fakeAsync, TestBed, tick, waitForAsync} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {ActivatedRoute, Router} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {TranslateModule} from '@ngx-translate/core';
import {BreadcrumbService, PageTitleService} from '@valtimo/components';
import {CaseManagementTabConfig, ConfigService, ConfigurationIssueService} from '@valtimo/shared';
import {SseService} from '@valtimo/sse';
import {IconService, Tab, TabsModule} from 'carbon-components-angular';
import {BehaviorSubject, EMPTY, of, Subject, throwError} from 'rxjs';
import {CaseDetailService, CaseManagementService, TabService} from '../../services';
import {
  CaseManagementDetailComponent,
  INJECTED_TAB_ENABLED_TIMEOUT_MS,
} from './case-management-detail.component';

describe('CaseManagementDetailComponent', () => {
  let fixture: ComponentFixture<CaseManagementDetailComponent>;
  let router: Router;
  let injectedTabs$: BehaviorSubject<CaseManagementTabConfig[]>;
  let mailTemplateEnabled$: Subject<boolean>;

  const CASE_ROUTE = 'case-management/case/my-case/version/1';

  const configureTestBed = (currentTabPath: string | null): void => {
    TestBed.configureTestingModule({
      declarations: [CaseManagementDetailComponent],
      imports: [RouterTestingModule, TabsModule, TranslateModule.forRoot()],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({caseDefinitionKey: 'my-case', caseDefinitionVersionTag: '1'}),
            parent: {params: of({})},
            firstChild: currentTabPath ? {routeConfig: {path: currentTabPath}} : null,
          },
        },
        {
          provide: BreadcrumbService,
          useValue: {setThirdBreadcrumb: () => {}, clearThirdBreadcrumb: () => {}},
        },
        {provide: CaseManagementService, useValue: {getConfigurationIssues: () => of([])}},
        {provide: ConfigService, useValue: {getFeatureToggleObservable: () => of(true)}},
        {
          provide: ConfigurationIssueService,
          useValue: {
            hasIssue$: () => of(false),
            hasAnyOfIssues$: () => of(false),
            setUnresolvedIssueTypes: () => {},
          },
        },
        {provide: IconService, useValue: {registerAll: () => {}}},
        {
          provide: PageTitleService,
          useValue: {
            customPageTitle$: of('My case'),
            disableReset: () => {},
            enableReset: () => {},
          },
        },
        {provide: SseService, useValue: {getSseEventObservable: () => new Subject()}},
        {
          provide: TabService,
          useValue: {injectedCaseManagementTabs$: injectedTabs$, currentTab: ''},
        },
      ],
    })
      .overrideComponent(CaseManagementDetailComponent, {
        set: {
          providers: [
            {
              provide: CaseDetailService,
              useValue: {
                caseDefinition$: of({
                  caseDefinitionKey: 'my-case',
                  caseDefinitionVersionTag: '1',
                  name: 'My case',
                }),
                selectedCaseDefinitionKey$: of('my-case'),
                selectedCaseDefinitionVersionTag$: of('1'),
                setSelectedCaseDefinitionKey: () => {},
                setSelectedCaseDefinitionVersionTag: () => {},
              },
            },
          ],
        },
      })
      .compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl');
    fixture = TestBed.createComponent(CaseManagementDetailComponent);
  };

  const renderedTabTitles = (): string[] =>
    fixture.debugElement
      .queryAll(By.directive(Tab))
      .map(tab => `${(tab.componentInstance as Tab).title}`);

  const navigatedTo = (): string[] =>
    (router.navigateByUrl as jasmine.Spy).calls.allArgs().map(args => `${args[0]}`);

  beforeEach(waitForAsync(() => {
    mailTemplateEnabled$ = new Subject<boolean>();
    injectedTabs$ = new BehaviorSubject<CaseManagementTabConfig[]>([
      {
        translationKey: 'Mail template',
        component: {} as any,
        tabRoute: 'mail-template',
        enabled$: mailTemplateEnabled$,
      },
    ]);
  }));

  it('stays on an injected tab route while that tab is still resolving', fakeAsync(() => {
    configureTestBed('mail-template');

    fixture.detectChanges();
    tick();

    expect(fixture.nativeElement.querySelector('cds-tabs')).toBeNull();
    expect(navigatedTo()).toEqual([]);

    tick(INJECTED_TAB_ENABLED_TIMEOUT_MS);
    fixture.detectChanges();
  }));

  it('renders the tab bar anyway when an injected tab never reports whether it is enabled', fakeAsync(() => {
    configureTestBed('mail-template');
    fixture.detectChanges();

    tick(INJECTED_TAB_ENABLED_TIMEOUT_MS);
    fixture.detectChanges();
    // Lets the tab bar run its own first-tab fallback, which is what used to send the page to General.
    tick();
    fixture.detectChanges();

    const mailTemplateTab = fixture.debugElement
      .queryAll(By.directive(Tab))
      .map(tab => tab.componentInstance as Tab)
      .find((tab: Tab) => tab.title === 'Mail template');
    expect(fixture.nativeElement.querySelector('cds-tabs')).not.toBeNull();
    expect(mailTemplateTab?.active).toBeTrue();
    expect(navigatedTo().filter((url: string) => url === `${CASE_ROUTE}/general`)).toEqual([]);
  }));

  it('stays on an injected tab route once that tab has resolved', fakeAsync(() => {
    configureTestBed('mail-template');
    fixture.detectChanges();

    mailTemplateEnabled$.next(true);
    fixture.detectChanges();
    tick();

    expect(fixture.nativeElement.querySelector('cds-tabs')).not.toBeNull();
    expect(navigatedTo().filter((url: string) => url === `${CASE_ROUTE}/general`)).toEqual([]);
  }));

  it('leaves out an injected tab that reports it is not available', fakeAsync(() => {
    configureTestBed('general');
    fixture.detectChanges();

    mailTemplateEnabled$.next(false);
    fixture.detectChanges();
    tick();

    expect(fixture.nativeElement.querySelector('cds-tabs')).not.toBeNull();
    expect(renderedTabTitles().length).toBeGreaterThan(0);
    expect(renderedTabTitles()).not.toContain('Mail template');
  }));

  it('leaves out an injected tab whose availability check fails', fakeAsync(() => {
    injectedTabs$.next([
      {
        translationKey: 'Mail template',
        component: {} as any,
        tabRoute: 'mail-template',
        enabled$: throwError(() => new Error('plugin configurations unavailable')),
      },
    ]);
    configureTestBed('general');
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('cds-tabs')).not.toBeNull();
    expect(renderedTabTitles().length).toBeGreaterThan(0);
    expect(renderedTabTitles()).not.toContain('Mail template');
  }));

  it('leaves out an injected tab whose availability check ends without answering', fakeAsync(() => {
    injectedTabs$.next([
      {
        translationKey: 'Mail template',
        component: {} as any,
        tabRoute: 'mail-template',
        enabled$: EMPTY,
      },
    ]);
    configureTestBed('general');
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('cds-tabs')).not.toBeNull();
    expect(renderedTabTitles().length).toBeGreaterThan(0);
    expect(renderedTabTitles()).not.toContain('Mail template');
  }));

  it('falls back to the general tab when the url names no tab', fakeAsync(() => {
    injectedTabs$.next([]);
    configureTestBed(null);

    fixture.detectChanges();
    tick();

    expect(navigatedTo()).toEqual([`${CASE_ROUTE}/general`]);
  }));
});
