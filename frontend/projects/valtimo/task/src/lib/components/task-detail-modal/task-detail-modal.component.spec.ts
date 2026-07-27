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

import {ComponentFixture, fakeAsync, flush, TestBed, tick} from '@angular/core/testing';
import {Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {PermissionRequest, PermissionService} from '@valtimo/access-control';
import {DocumentService} from '@valtimo/document';
import {GlobalNotificationService} from '@valtimo/shared';
import {SseService} from '@valtimo/sse';
import {IconService} from 'carbon-components-angular';
import {NGXLogger} from 'ngx-logger';
import {of, Subject, throwError} from 'rxjs';
import {Task, TaskUpdateSseEvent} from '../../models';
import {TaskIntermediateSaveService, TaskService} from '../../services';
import {TASK_DETAIL_PERMISSION_RESOURCE} from '../../task-permissions';
import {TaskDetailModalComponent} from './task-detail-modal.component';

describe('TaskDetailModalComponent', () => {
  const task = {
    id: 'task-1',
    name: 'Test task',
    businessKey: 'business-key',
    created: '2026-01-01',
    assignee: null,
  } as unknown as Task;

  let fixture: ComponentFixture<TaskDetailModalComponent>;
  let component: TaskDetailModalComponent;
  let permissionService: jasmine.SpyObj<PermissionService>;
  let taskService: jasmine.SpyObj<TaskService>;
  let permissionResults: {[action: string]: boolean};
  let sseEvents$: Subject<TaskUpdateSseEvent>;

  beforeEach(() => {
    permissionResults = {assign: true, modify: true, view: true};
    sseEvents$ = new Subject<TaskUpdateSseEvent>();

    permissionService = jasmine.createSpyObj('PermissionService', [
      'requestPermission',
      'invalidateResource',
    ]);
    permissionService.requestPermission.and.callFake((request: PermissionRequest) =>
      of(permissionResults[request.action])
    );

    taskService = jasmine.createSpyObj('TaskService', [
      'assignTask',
      'unassignTask',
      'getTask',
      'getCandidateUsers',
      'getCandidateTeams',
    ]);

    TestBed.configureTestingModule({
      declarations: [TaskDetailModalComponent],
      providers: [
        {provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate'])},
        {provide: TranslateService, useValue: {instant: (key: string) => key}},
        {provide: PermissionService, useValue: permissionService},
        {provide: NGXLogger, useValue: jasmine.createSpyObj('NGXLogger', ['debug', 'error'])},
        {
          provide: TaskIntermediateSaveService,
          useValue: jasmine.createSpyObj('TaskIntermediateSaveService', ['setSubmission']),
        },
        {provide: SseService, useValue: {getSseEventObservable: () => sseEvents$.asObservable()}},
        {provide: IconService, useValue: jasmine.createSpyObj('IconService', ['registerAll'])},
        {
          provide: DocumentService,
          useValue: jasmine.createSpyObj('DocumentService', ['getDocument']),
        },
        {provide: TaskService, useValue: taskService},
        {
          provide: GlobalNotificationService,
          useValue: jasmine.createSpyObj('GlobalNotificationService', ['showToast']),
        },
      ],
    });

    TestBed.overrideComponent(TaskDetailModalComponent, {
      set: {template: '', styles: []},
    });

    fixture = TestBed.createComponent(TaskDetailModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('requests the assign permission when a task is opened', fakeAsync(() => {
    component.openTaskDetails(task);
    tick();

    expect(component.canAssignUserToTask$.getValue()).toBeTrue();
    expect(component.modalOpen$.getValue()).toBeTrue();
  }));

  it('re-evaluates the assign permission after an assignment change', fakeAsync(() => {
    component.openTaskDetails(task);
    tick();
    expect(component.canAssignUserToTask$.getValue()).toBeTrue();

    permissionResults['assign'] = false;
    taskService.assignTask.and.returnValue(of(null));
    taskService.getTask.and.returnValue(of({task: {id: task.id, assignee: 'other-user'}}));
    const assignmentOfTaskChangedSpy = spyOn(component.assignmentOfTaskChanged, 'emit');

    component.onAssignmentChanged({userId: 'other-user'});

    expect(permissionService.invalidateResource).toHaveBeenCalledWith(
      TASK_DETAIL_PERMISSION_RESOURCE.task,
      task.id
    );
    expect(component.canAssignUserToTask$.getValue()).toBeFalse();
    expect(component.modalOpen$.getValue()).toBeTrue();
    expect(assignmentOfTaskChangedSpy).toHaveBeenCalled();
  }));

  it('closes the modal when the view permission is lost after an assignment change', fakeAsync(() => {
    component.openTaskDetails(task);
    tick();
    expect(component.modalOpen$.getValue()).toBeTrue();

    permissionResults['view'] = false;
    taskService.assignTask.and.returnValue(of(null));
    taskService.getTask.and.returnValue(of({task: {id: task.id, assignee: 'other-user'}}));

    component.onAssignmentChanged({userId: 'other-user'});

    expect(component.modalOpen$.getValue()).toBeFalse();
    flush();
  }));

  it('closes the modal when the task can no longer be fetched after an assignment change', fakeAsync(() => {
    component.openTaskDetails(task);
    tick();

    taskService.assignTask.and.returnValue(of(null));
    taskService.getTask.and.returnValue(throwError(() => ({status: 403})));
    const assignmentOfTaskChangedSpy = spyOn(component.assignmentOfTaskChanged, 'emit');

    component.onAssignmentChanged({userId: 'other-user'});

    expect(component.modalOpen$.getValue()).toBeFalse();
    expect(assignmentOfTaskChangedSpy).toHaveBeenCalled();
    flush();
  }));

  it('closes the modal when the task can no longer be viewed after an external update', fakeAsync(() => {
    component.openTaskDetails(task);
    tick();

    taskService.getTask.and.returnValue(throwError(() => ({status: 403})));

    sseEvents$.next({taskId: task.id} as TaskUpdateSseEvent);

    expect(permissionService.invalidateResource).toHaveBeenCalledWith(
      TASK_DETAIL_PERMISSION_RESOURCE.task,
      task.id
    );
    expect(component.modalOpen$.getValue()).toBeFalse();
    flush();
  }));
});
