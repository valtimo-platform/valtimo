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
import {CommonModule} from '@angular/common';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {TranslateModule} from '@ngx-translate/core';
import {PermissionRequest, PermissionService} from '@valtimo/access-control';
import {TaskWithProcessLink} from '@valtimo/process-link';
import {ConfigService, GlobalNotificationService} from '@valtimo/shared';
import {IconService} from 'carbon-components-angular';
import {BehaviorSubject, Observable, of, Subject} from 'rxjs';
import {Task} from '../../models';
import {TaskIntermediateSaveService, TaskService} from '../../services';
import {TaskDetailIntermediateSaveComponent} from './task-detail-intermediate-save.component';

describe('TaskDetailIntermediateSaveComponent', () => {
  const task = {
    id: 'task-1',
    name: 'Test task',
    created: '2026-01-01',
    assignee: null,
  } as unknown as Task;

  let fixture: ComponentFixture<TaskDetailIntermediateSaveComponent>;
  let component: TaskDetailIntermediateSaveComponent;
  let permissionService: jasmine.SpyObj<PermissionService>;
  let completePermission$: Subject<boolean>;

  const saveButton = (): HTMLButtonElement =>
    fixture.nativeElement.querySelector('button[cdsIcon="save"]');
  const clearButton = (): HTMLButtonElement =>
    fixture.nativeElement.querySelector('button[cdsIcon="recently-viewed"]');

  const openTask = (value: Task = task): void => {
    component.task = value;
    fixture.detectChanges();
  };

  beforeEach(() => {
    completePermission$ = new BehaviorSubject<boolean>(true);

    permissionService = jasmine.createSpyObj('PermissionService', ['requestPermission']);
    permissionService.requestPermission.and.callFake(
      (request: PermissionRequest): Observable<boolean> =>
        request.action === 'complete' ? completePermission$.asObservable() : of(true)
    );

    const intermediateSaveService = jasmine.createSpyObj('TaskIntermediateSaveService', [
      'getIntermediateSubmission',
      'setSubmission',
    ]);
    intermediateSaveService.getIntermediateSubmission.and.callFake(() =>
      of({submission: {field: 'value'}, createdOn: '2026-01-01T10:00:00'})
    );

    TestBed.configureTestingModule({
      imports: [TaskDetailIntermediateSaveComponent, TranslateModule.forRoot()],
      providers: [
        {provide: ConfigService, useValue: {getFeatureToggleObservable: () => of(true)}},
        {
          provide: GlobalNotificationService,
          useValue: jasmine.createSpyObj('GlobalNotificationService', ['showToast']),
        },
        {provide: IconService, useValue: jasmine.createSpyObj('IconService', ['registerAll'])},
        {provide: PermissionService, useValue: permissionService},
        {provide: TaskIntermediateSaveService, useValue: intermediateSaveService},
        {provide: TaskService, useValue: {getTaskProcessLink: () => of(null)}},
      ],
    });

    TestBed.overrideComponent(TaskDetailIntermediateSaveComponent, {
      set: {imports: [CommonModule, TranslateModule], schemas: [NO_ERRORS_SCHEMA]},
    });

    fixture = TestBed.createComponent(TaskDetailIntermediateSaveComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('disables saving and clearing progress when the complete permission is denied', () => {
    completePermission$.next(false);
    openTask();

    expect(saveButton().disabled).toBeTrue();
    expect(clearButton().disabled).toBeTrue();
    expect(permissionService.requestPermission).toHaveBeenCalledWith(
      jasmine.objectContaining({action: 'complete'}),
      jasmine.objectContaining({identifier: task.id})
    );
  });

  it('enables saving and clearing progress when the complete permission is granted', () => {
    openTask();

    expect(saveButton().disabled).toBeFalse();
    expect(clearButton().disabled).toBeFalse();
  });

  it('keeps saving and clearing progress disabled until the complete permission is answered', () => {
    completePermission$ = new Subject<boolean>();
    openTask();

    expect(saveButton().disabled).toBeTrue();
    expect(clearButton().disabled).toBeTrue();

    completePermission$.next(true);
    fixture.detectChanges();

    expect(saveButton().disabled).toBeFalse();
    expect(clearButton().disabled).toBeFalse();
  });

  it('follows a changed answer when the complete permission is re-requested', () => {
    openTask();
    expect(saveButton().disabled).toBeFalse();

    completePermission$ = new BehaviorSubject<boolean>(false);
    component.refreshCompleteTaskPermission();
    fixture.detectChanges();

    expect(saveButton().disabled).toBeTrue();
    expect(clearButton().disabled).toBeTrue();
  });

  it('disables saving progress again when the same task is reopened until its answer arrives', () => {
    openTask();
    expect(saveButton().disabled).toBeFalse();

    completePermission$ = new Subject<boolean>();
    component.task = null;
    openTask();

    expect(saveButton().disabled).toBeTrue();
  });

  it('disables saving progress again when the same task is reopened with its process link until its answer arrives', () => {
    const taskAndProcessLink = {
      task,
      processLinkActivityResult: null,
    } as unknown as TaskWithProcessLink;
    component.taskAndProcessLink = taskAndProcessLink;
    fixture.detectChanges();
    expect(saveButton().disabled).toBeFalse();

    completePermission$ = new Subject<boolean>();
    component.taskAndProcessLink = taskAndProcessLink;
    fixture.detectChanges();

    expect(saveButton().disabled).toBeTrue();
  });

  it('keeps the previous answer while the same task is re-checked', () => {
    openTask();

    completePermission$ = new Subject<boolean>();
    openTask({...task, assignee: 'user-1'} as Task);

    expect(saveButton().disabled).toBeFalse();
  });
});
