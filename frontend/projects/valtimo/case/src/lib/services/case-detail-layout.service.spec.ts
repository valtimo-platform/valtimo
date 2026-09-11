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
import {PageHeaderService} from '@valtimo/components';
import {UserSettings, UserSettingsService} from '@valtimo/shared';
import {of} from 'rxjs';
import {take} from 'rxjs/operators';
import {CaseDetailLayout} from '../models';
import {CaseDetailLayoutService} from './case-detail-layout.service';
import {CaseTabService} from './case-tab.service';

describe('CaseDetailLayoutService', () => {
  let service: CaseDetailLayoutService;
  let userSettingsService: jasmine.SpyObj<UserSettingsService>;

  const CONTAINER_WIDTH = 1600;

  const createService = (settings: UserSettings): CaseDetailLayoutService => {
    userSettingsService.getUserSettings.and.returnValue(of(settings));

    TestBed.configureTestingModule({
      providers: [
        CaseDetailLayoutService,
        {provide: CaseTabService, useValue: {showTaskList$: of(true)}},
        {provide: PageHeaderService, useValue: {compactMode$: of(false)}},
        {provide: UserSettingsService, useValue: userSettingsService},
      ],
    });

    return TestBed.inject(CaseDetailLayoutService);
  };

  /** The layout only emits once the case detail view has reported its container width. */
  const layoutAfterContainerWidth = (
    layoutService: CaseDetailLayoutService,
    onLayout: (layout: CaseDetailLayout) => void
  ): void => {
    layoutService.caseDetailLayout$.pipe(take(2)).subscribe(layout => {
      if ((layout as CaseDetailLayout).showRightPanel) onLayout(layout);
    });
    layoutService.setTabContentContainerWidth(CONTAINER_WIDTH);
  };

  beforeEach(() => {
    userSettingsService = jasmine.createSpyObj('UserSettingsService', [
      'getUserSettings',
      'saveUserSettings',
    ]);
    userSettingsService.saveUserSettings.and.returnValue(of(null));
  });

  it('lets the task list panel be resized, at its default width when nothing is saved', done => {
    service = createService({});

    layoutAfterContainerWidth(service, layout => {
      expect(layout.widthAdjustable).toBeTrue();
      expect(layout.rightPanelWidth).toBe(412);
      expect(layout.rightPanelMinWidth).toBe(320);
      done();
    });
  });

  it('opens the task list panel at the width the user saved earlier', done => {
    service = createService({taskPanelWidth: 700});

    layoutAfterContainerWidth(service, layout => {
      expect(layout.rightPanelWidth).toBe(700);
      done();
    });
  });

  it('opens a task form at the saved width instead of the minimum for its form size', done => {
    service = createService({taskPanelWidth: 700});
    service.setFormDisplayType('panel');
    service.setFormDisplaySize('medium');
    service.setTaskAndProcessLinkOpenedInPanel({} as any);

    layoutAfterContainerWidth(service, layout => {
      expect(layout.rightPanelWidth).toBe(700);
      done();
    });
  });

  it('shrinks a saved width that no longer fits to the space the panel has', done => {
    service = createService({taskPanelWidth: 5000});

    layoutAfterContainerWidth(service, layout => {
      expect(layout.rightPanelWidth).toBe(1248);
      expect(layout.rightPanelMaxWidth).toBe(1248);
      done();
    });
  });

  it('stores a dragged width in the user settings, keeping the other settings', () => {
    service = createService({compactMode: true, taskPanelWidth: 412});

    service.saveTaskPanelWidth(683.4);

    expect(userSettingsService.saveUserSettings).toHaveBeenCalledWith({
      compactMode: true,
      taskPanelWidth: 683,
    });
  });

  it('does not store a width that is already the saved one', () => {
    service = createService({taskPanelWidth: 683});

    service.saveTaskPanelWidth(683);

    expect(userSettingsService.saveUserSettings).not.toHaveBeenCalled();
  });
});
