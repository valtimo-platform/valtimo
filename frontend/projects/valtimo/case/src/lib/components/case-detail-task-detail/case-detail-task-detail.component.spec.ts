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

import {ComponentFixture, TestBed} from '@angular/core/testing';
import {TranslateService} from '@ngx-translate/core';
import {PermissionService} from '@valtimo/access-control';
import {TaskWithProcessLink} from '@valtimo/process-link';
import {ConfigService} from '@valtimo/shared';
import {TASK_DETAIL_PERMISSION_RESOURCE, TaskService} from '@valtimo/task';
import {IconService} from 'carbon-components-angular';
import {of, take} from 'rxjs';
import {CaseDetailsTaskDetailComponent} from './case-detail-task-detail.component';

describe('CaseDetailsTaskDetailComponent', () => {
  const taskWithProcessLink = {
    task: {id: 'task-1', name: 'Test task', created: '2026-01-01', assignee: null},
    processLinkActivityResult: null,
  } as unknown as TaskWithProcessLink;

  let fixture: ComponentFixture<CaseDetailsTaskDetailComponent>;
  let component: CaseDetailsTaskDetailComponent;
  let permissionService: jasmine.SpyObj<PermissionService>;
  let taskService: jasmine.SpyObj<TaskService>;
  let content: jasmine.SpyObj<{refreshCompleteTaskPermission: () => void}>;
  let intermediateSave: jasmine.SpyObj<{refreshCompleteTaskPermission: () => void}>;

  beforeEach(() => {
    permissionService = jasmine.createSpyObj('PermissionService', [
      'requestPermission',
      'invalidateResource',
    ]);
    permissionService.requestPermission.and.returnValue(of(true));

    taskService = jasmine.createSpyObj('TaskService', [
      'assignTask',
      'unassignTask',
      'getTask',
      'getCandidateUsers',
      'getCandidateTeams',
    ]);
    taskService.assignTask.and.returnValue(of(null));
    taskService.getTask.and.returnValue(of({task: {id: 'task-1', assignee: 'other-user'}}));

    TestBed.configureTestingModule({
      imports: [CaseDetailsTaskDetailComponent],
      providers: [
        {provide: ConfigService, useValue: {getFeatureToggleObservable: () => of(false)}},
        {provide: IconService, useValue: jasmine.createSpyObj('IconService', ['register'])},
        {provide: PermissionService, useValue: permissionService},
        {provide: TranslateService, useValue: {instant: (key: string) => key}},
        {provide: TaskService, useValue: taskService},
      ],
    });

    TestBed.overrideComponent(CaseDetailsTaskDetailComponent, {
      set: {imports: [], template: '', styles: []},
    });

    fixture = TestBed.createComponent(CaseDetailsTaskDetailComponent);
    component = fixture.componentInstance;
    component.taskAndProcessLink = taskWithProcessLink;
    fixture.detectChanges();

    content = jasmine.createSpyObj('TaskDetailContentComponent', ['refreshCompleteTaskPermission']);
    intermediateSave = jasmine.createSpyObj('TaskDetailIntermediateSaveComponent', [
      'refreshCompleteTaskPermission',
    ]);
    (component as any)._taskDetailContentComponent = content;
  });

  it('invalidates the cached permissions of the task before checking them when it is opened', () => {
    component.canAssignUserToTask$.pipe(take(1)).subscribe();

    expect(permissionService.invalidateResource).toHaveBeenCalledWith(
      TASK_DETAIL_PERMISSION_RESOURCE.task,
      'task-1'
    );
    expect(permissionService.invalidateResource).toHaveBeenCalledBefore(
      permissionService.requestPermission
    );
  });

  it('makes the task content and intermediate save re-check the complete permission after an assignment change', () => {
    (component as any)._intermediateSaveComponent = intermediateSave;

    component.onAssignmentChanged({userId: 'other-user'});

    expect(permissionService.invalidateResource).toHaveBeenCalledWith(
      TASK_DETAIL_PERMISSION_RESOURCE.task,
      'task-1'
    );
    expect(content.refreshCompleteTaskPermission).toHaveBeenCalled();
    expect(intermediateSave.refreshCompleteTaskPermission).toHaveBeenCalled();
  });

  it('re-checks the task content after an assignment change when intermediate save is not shown', () => {
    const assignmentOfTaskChangedSpy = spyOn(component.assignmentOfTaskChanged, 'emit');

    component.onAssignmentChanged({userId: 'other-user'});

    expect(content.refreshCompleteTaskPermission).toHaveBeenCalled();
    expect(assignmentOfTaskChangedSpy).toHaveBeenCalled();
  });
});
