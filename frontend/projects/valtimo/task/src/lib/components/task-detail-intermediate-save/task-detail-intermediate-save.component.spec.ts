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
import {TranslateService} from '@ngx-translate/core';
import {TaskProcessLinkType, TaskWithProcessLink} from '@valtimo/process-link';
import {ConfigService, GlobalNotificationService} from '@valtimo/shared';
import {IconService} from 'carbon-components-angular';
import {of} from 'rxjs';
import {IntermediateSaveRequest, IntermediateSubmission, Task} from '../../models';
import {TaskIntermediateSaveService, TaskService} from '../../services';
import {TaskDetailIntermediateSaveComponent} from './task-detail-intermediate-save.component';

describe('TaskDetailIntermediateSaveComponent', () => {
  const task = {id: 'task-1', name: 'Test task', created: '2026-01-01'} as unknown as Task;

  let component: TaskDetailIntermediateSaveComponent;
  let intermediateSaveService: TaskIntermediateSaveService;
  let storeSpy: jasmine.Spy;

  const taskWithProcessLink = (type: TaskProcessLinkType): TaskWithProcessLink =>
    ({
      task,
      processLinkActivityResult: {type, properties: {}},
    }) as unknown as TaskWithProcessLink;

  const savedSubmissions = (): any[] =>
    storeSpy.calls.allArgs().map(([request]: [IntermediateSaveRequest]) => request.submission);

  const setUp = (existingSave: IntermediateSubmission | null): void => {
    intermediateSaveService = new TaskIntermediateSaveService(
      {} as any,
      {config: {valtimoApi: {endpointUri: '/api/'}}} as ConfigService
    );
    spyOn(intermediateSaveService, 'getIntermediateSubmission').and.returnValue(of(existingSave));
    storeSpy = spyOn(intermediateSaveService, 'storeIntermediateSubmission').and.callFake(
      (request: IntermediateSaveRequest) =>
        of({submission: request.submission, createdOn: '2026-01-01'} as IntermediateSubmission)
    );

    TestBed.configureTestingModule({
      imports: [TaskDetailIntermediateSaveComponent],
      providers: [
        {provide: TaskIntermediateSaveService, useValue: intermediateSaveService},
        {
          provide: TaskService,
          useValue: jasmine.createSpyObj('TaskService', ['getTaskProcessLink']),
        },
        {provide: ConfigService, useValue: {getFeatureToggleObservable: () => of(true)}},
        {provide: GlobalNotificationService, useValue: jasmine.createSpyObj('GNS', ['showToast'])},
        {provide: IconService, useValue: jasmine.createSpyObj('IconService', ['registerAll'])},
        {provide: TranslateService, useValue: {instant: (key: string) => key}},
      ],
    }).overrideComponent(TaskDetailIntermediateSaveComponent, {set: {template: ''}});

    component = TestBed.createComponent(TaskDetailIntermediateSaveComponent).componentInstance;
  };

  it('saves the latest form changes on every save', () => {
    setUp(null);
    component.taskAndProcessLink = taskWithProcessLink('form');

    intermediateSaveService.setFormIoFormData({field: 'first'});
    component.saveCurrentProgress();
    intermediateSaveService.setFormIoFormData({field: 'second'});
    component.saveCurrentProgress();

    expect(savedSubmissions()).toEqual([{field: 'first'}, {field: 'second'}]);
  });

  it('saves the form changes made after reopening a task with saved progress', () => {
    setUp({submission: {field: 'saved'}, createdOn: '2026-01-01'} as IntermediateSubmission);
    component.taskAndProcessLink = taskWithProcessLink('form');

    intermediateSaveService.setFormIoFormData({field: 'edited'});
    component.saveCurrentProgress();

    expect(savedSubmissions()).toEqual([{field: 'edited'}]);
  });

  it('saves the form view model submission', () => {
    setUp(null);
    component.taskAndProcessLink = taskWithProcessLink('form-view-model');

    intermediateSaveService.setSubmission({data: {field: 'view model'}});
    component.saveCurrentProgress();

    expect(savedSubmissions()).toEqual([{field: 'view model'}]);
  });
});
