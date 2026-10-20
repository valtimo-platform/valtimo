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

import {Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {TranslateService} from '@ngx-translate/core';
import {PageHeaderService, SidePanelOffer, SidePanelService} from '@valtimo/components';
import {TaskWithProcessLink} from '@valtimo/process-link';
import {UserSettingsService} from '@valtimo/shared';
import {BehaviorSubject, firstValueFrom, of} from 'rxjs';
import {CaseDetailTaskPanelComponent} from '../components/case-detail-task-panel/case-detail-task-panel.component';
import {CaseDetailLayoutService} from './case-detail-layout.service';
import {CaseDetailTaskPanelService} from './case-detail-task-panel.service';
import {CaseTabService} from './case-tab.service';

@Component({standalone: true, template: ''})
class OtherContentComponent {}

describe('CaseDetailTaskPanelService', () => {
  let layoutService: CaseDetailLayoutService;
  let service: CaseDetailTaskPanelService;
  let showTaskList$: BehaviorSubject<boolean>;
  let sidePanelService: SidePanelService;
  let userSettingsService: jasmine.SpyObj<UserSettingsService>;

  const current = (): Promise<SidePanelOffer | null> => firstValueFrom(sidePanelService.current$);
  const visible = (): Promise<boolean> => firstValueFrom(sidePanelService.visible$);

  beforeEach(() => {
    showTaskList$ = new BehaviorSubject<boolean>(true);
    userSettingsService = jasmine.createSpyObj('UserSettingsService', [
      'getUserSettings',
      'saveUserSettings',
    ]);
    userSettingsService.getUserSettings.and.returnValue(of({}));
    userSettingsService.saveUserSettings.and.returnValue(of(null));
    TestBed.configureTestingModule({
      providers: [
        CaseDetailLayoutService,
        CaseDetailTaskPanelService,
        {provide: CaseTabService, useValue: {showTaskList$}},
        {provide: PageHeaderService, useValue: {compactMode$: of(false)}},
        {provide: TranslateService, useValue: {stream: () => of('Tasks')}},
        {provide: UserSettingsService, useValue: userSettingsService},
      ],
    });
    layoutService = TestBed.inject(CaseDetailLayoutService);
    service = TestBed.inject(CaseDetailTaskPanelService);
    sidePanelService = TestBed.inject(SidePanelService);
  });

  afterEach(() => service.ngOnDestroy());

  it('shows the task panel on a tab that shows tasks', async () => {
    service.open();

    const offer = await current();
    expect(offer?.component).toBe(CaseDetailTaskPanelComponent);
    expect(offer?.title).toBe('Tasks');
    expect(offer?.injector).toBeDefined();
    expect(await visible()).toBeTrue();
  });

  it('does not render the panel when the first tab hides tasks', async () => {
    showTaskList$.next(false);
    service.open();

    expect(await current()).toBeNull();
  });

  it('hides the panel on a task-hiding tab but keeps its content', async () => {
    service.open();
    showTaskList$.next(false);

    expect(await visible()).toBeFalse();
    expect((await current())?.component).toBe(CaseDetailTaskPanelComponent);

    showTaskList$.next(true);

    expect(await visible()).toBeTrue();
  });

  it('keeps a form open in the panel visible on a task-hiding tab, at its minimum width', async () => {
    service.open();
    layoutService.openStartFormPanel({template: {} as any, title: 'Start'}, 'small');
    showTaskList$.next(false);

    expect(await visible()).toBeTrue();
    expect((await current())?.minWidth).toBe(320);

    layoutService.closeStartFormPanel();
    layoutService.setTaskAndProcessLinkOpenedInPanel({} as TaskWithProcessLink);

    expect(await visible()).toBeTrue();

    layoutService.setTaskAndProcessLinkOpenedInPanel(null);

    expect(await visible()).toBeFalse();
  });

  it('withdraws the panel when the case detail is left', async () => {
    service.open();
    service.ngOnDestroy();

    expect(await current()).toBeNull();
  });

  it('stays closed after the user closes it, until toggled open again', async () => {
    service.open();
    sidePanelService.dismiss();
    showTaskList$.next(false);
    showTaskList$.next(true);

    expect(await visible()).toBeFalse();

    service.toggle();

    expect(await visible()).toBeTrue();
  });

  it('reopens for a start form after the user closed it', async () => {
    service.open();
    service.toggle();

    layoutService.openStartFormPanel({template: {} as any, title: 'Start'}, 'small');

    expect(await visible()).toBeTrue();
  });

  it('leaves other content alone until toggled open again', async () => {
    service.open();
    sidePanelService.offer({key: 'other', title: 'Other', component: OtherContentComponent});
    showTaskList$.next(false);
    showTaskList$.next(true);

    expect((await current())?.key).toBe('other');

    service.toggle();

    expect((await current())?.component).toBe(CaseDetailTaskPanelComponent);
    expect(await visible()).toBeTrue();
  });

  it('shows the task list at its default width when the user saved none', async () => {
    service.open();

    expect((await current())?.width).toBe(412);
  });

  it('saves a resize of the task panel in the user settings', async () => {
    service.open();
    sidePanelService.setWidth(450);
    sidePanelService.endResize();

    expect(userSettingsService.saveUserSettings).toHaveBeenCalledOnceWith({taskPanelWidth: 450});
    expect((await current())?.width).toBe(450);
  });
});

describe('CaseDetailTaskPanelService with a saved width', () => {
  it('shows the task panel at the width the user saved', async () => {
    TestBed.configureTestingModule({
      providers: [
        CaseDetailLayoutService,
        CaseDetailTaskPanelService,
        {provide: CaseTabService, useValue: {showTaskList$: of(true)}},
        {provide: PageHeaderService, useValue: {compactMode$: of(false)}},
        {provide: TranslateService, useValue: {stream: () => of('Tasks')}},
        {
          provide: UserSettingsService,
          useValue: {getUserSettings: () => of({taskPanelWidth: 460})},
        },
      ],
    });
    const service = TestBed.inject(CaseDetailTaskPanelService);
    service.open();

    expect((await firstValueFrom(TestBed.inject(SidePanelService).current$))?.width).toBe(460);
    service.ngOnDestroy();
  });
});
