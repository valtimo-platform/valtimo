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
import {CommonModule} from '@angular/common';
import {Component, NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, fakeAsync, TestBed, tick, waitForAsync} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {ActivatedRoute} from '@angular/router';
import {TranslateModule, TranslatePipe} from '@ngx-translate/core';
import {PageTitleService} from '@valtimo/components';
import {BUILDING_BLOCK_MANAGEMENT_TAB_TOKEN} from '@valtimo/shared';
import {Tab, TabsModule} from 'carbon-components-angular';
import {EMPTY, Observable, of, Subject, throwError} from 'rxjs';
import {BuildingBlockManagementDetailService} from '../../services';
import {
  BuildingBlockManagementDetailComponent,
  CUSTOM_TAB_ENABLED_TIMEOUT_MS,
} from './building-block-management-detail.component';

@Component({standalone: true, template: ''})
class MailTemplateListStubComponent {}

describe('BuildingBlockManagementDetailComponent', () => {
  let fixture: ComponentFixture<BuildingBlockManagementDetailComponent>;
  let detailService: jasmine.SpyObj<BuildingBlockManagementDetailService>;
  let mailTemplateEnabled$: Subject<boolean>;

  const configureTestBed = (
    activeTabKey: string,
    enabled$: Observable<boolean> = mailTemplateEnabled$
  ): void => {
    detailService = jasmine.createSpyObj<BuildingBlockManagementDetailService>(
      'BuildingBlockManagementDetailService',
      ['navigateToTab', 'setRoute'],
      {activeTabKey$: of(activeTabKey) as any}
    );

    TestBed.configureTestingModule({
      imports: [BuildingBlockManagementDetailComponent, TranslateModule.forRoot()],
      providers: [
        {provide: ActivatedRoute, useValue: {params: of({}), parent: {params: of({})}}},
        {provide: PageTitleService, useValue: {disableReset: () => {}, enableReset: () => {}}},
        {
          provide: BUILDING_BLOCK_MANAGEMENT_TAB_TOKEN,
          useValue: [
            {
              translationKey: 'Mail template',
              component: MailTemplateListStubComponent,
              tabRoute: 'mail-template',
              enabled$,
            },
          ],
        },
      ],
    }).overrideComponent(BuildingBlockManagementDetailComponent, {
      set: {
        imports: [CommonModule, TabsModule, TranslatePipe],
        schemas: [NO_ERRORS_SCHEMA],
        providers: [{provide: BuildingBlockManagementDetailService, useValue: detailService}],
      },
    });

    fixture = TestBed.createComponent(BuildingBlockManagementDetailComponent);
  };

  const renderedTabHeadings = (): string[] =>
    fixture.debugElement
      .queryAll(By.directive(Tab))
      .map(tab => `${(tab.componentInstance as Tab).heading}`);

  beforeEach(waitForAsync(() => {
    mailTemplateEnabled$ = new Subject<boolean>();
  }));

  it('stays on a custom tab route while that tab is still resolving', fakeAsync(() => {
    configureTestBed('mail-template');

    fixture.detectChanges();
    tick();

    expect(fixture.nativeElement.querySelector('cds-tabs')).toBeNull();
    expect(detailService.navigateToTab).not.toHaveBeenCalled();

    tick(CUSTOM_TAB_ENABLED_TIMEOUT_MS);
    fixture.detectChanges();
  }));

  it('renders the tab bar anyway when a custom tab never reports whether it is enabled', fakeAsync(() => {
    configureTestBed('mail-template');
    fixture.detectChanges();

    tick(CUSTOM_TAB_ENABLED_TIMEOUT_MS);
    fixture.detectChanges();
    // Lets the tab bar run its own first-tab fallback, which is what used to send the page to General.
    tick();
    fixture.detectChanges();

    const mailTemplateTab = fixture.debugElement
      .queryAll(By.directive(Tab))
      .map(tab => tab.componentInstance as Tab)
      .find((tab: Tab) => tab.heading === 'Mail template');
    expect(fixture.nativeElement.querySelector('cds-tabs')).not.toBeNull();
    expect(mailTemplateTab?.active).toBeTrue();
    expect(detailService.navigateToTab).not.toHaveBeenCalled();
  }));

  it('stays on a custom tab route once that tab has resolved', fakeAsync(() => {
    configureTestBed('mail-template');
    fixture.detectChanges();

    mailTemplateEnabled$.next(true);
    fixture.detectChanges();
    tick();

    expect(fixture.nativeElement.querySelector('cds-tabs')).not.toBeNull();
    expect(detailService.navigateToTab).not.toHaveBeenCalled();
  }));

  it('leaves out a custom tab that reports it is not available', fakeAsync(() => {
    configureTestBed('general');
    fixture.detectChanges();

    mailTemplateEnabled$.next(false);
    fixture.detectChanges();
    tick();

    expect(fixture.nativeElement.querySelector('cds-tabs')).not.toBeNull();
    expect(renderedTabHeadings().length).toBeGreaterThan(0);
    expect(renderedTabHeadings()).not.toContain('Mail template');
  }));

  it('leaves out a custom tab whose availability check fails', fakeAsync(() => {
    configureTestBed(
      'general',
      throwError(() => new Error('plugin configurations unavailable'))
    );
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('cds-tabs')).not.toBeNull();
    expect(renderedTabHeadings().length).toBeGreaterThan(0);
    expect(renderedTabHeadings()).not.toContain('Mail template');
  }));

  it('leaves out a custom tab whose availability check ends without answering', fakeAsync(() => {
    configureTestBed('general', EMPTY);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('cds-tabs')).not.toBeNull();
    expect(renderedTabHeadings().length).toBeGreaterThan(0);
    expect(renderedTabHeadings()).not.toContain('Mail template');
  }));
});
