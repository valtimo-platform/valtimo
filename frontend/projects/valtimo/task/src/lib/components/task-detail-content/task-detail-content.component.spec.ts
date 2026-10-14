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

import {Component, EventEmitter, Input, NO_ERRORS_SCHEMA, Output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {Router} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {PermissionRequest, PermissionService} from '@valtimo/access-control';
import {FormIoStateService, ValtimoModalService} from '@valtimo/components';
import {DocumentService} from '@valtimo/document';
import {ProcessLinkService, TaskWithProcessLink, UrlResolverService} from '@valtimo/process-link';
import {ConfigService, GlobalNotificationService} from '@valtimo/shared';
import {IconService} from 'carbon-components-angular';
import {NGXLogger} from 'ngx-logger';
import {BehaviorSubject, Observable, of, Subject} from 'rxjs';
import {Task} from '../../models';
import {TaskIntermediateSaveService, TaskService} from '../../services';
import {TaskDetailContentComponent} from './task-detail-content.component';

@Component({
  selector: 'valtimo-form-io',
  standalone: true,
  template: '',
})
class FormIoStubComponent {
  public static instances = 0;
  @Input() public form: any;
  @Input() public options: any;
  @Input() public readOnly = false;
  @Input() public submission: any;
  // eslint-disable-next-line @angular-eslint/no-output-native
  @Output() public readonly submit = new EventEmitter<any>();
  // eslint-disable-next-line @angular-eslint/no-output-native
  @Output() public readonly change = new EventEmitter<any>();

  constructor() {
    FormIoStubComponent.instances++;
  }
}

describe('TaskDetailContentComponent', () => {
  const task = {
    id: 'task-1',
    name: 'Test task',
    businessKey: 'business-key',
    processInstanceId: 'process-instance-1',
    created: '2026-01-01',
    assignee: null,
  } as unknown as Task;

  const taskWithFormLink = {
    task,
    processLinkActivityResult: {
      processLinkId: 'process-link-1',
      type: 'form',
      assignee: null,
      due: null,
      properties: {
        prefilledForm: {components: [{type: 'button', key: 'submit', action: 'submit'}]},
      },
    },
  } as unknown as TaskWithProcessLink;

  let fixture: ComponentFixture<TaskDetailContentComponent>;
  let component: TaskDetailContentComponent;
  let permissionService: jasmine.SpyObj<PermissionService>;
  let processLinkService: jasmine.SpyObj<ProcessLinkService>;
  let completePermission$: Subject<boolean>;

  const renderedForm = (): FormIoStubComponent | null =>
    fixture.debugElement.query(By.directive(FormIoStubComponent))?.componentInstance ?? null;

  const openTask = (): void => {
    component.taskAndProcessLink = taskWithFormLink;
    fixture.detectChanges();
  };

  beforeEach(() => {
    FormIoStubComponent.instances = 0;
    completePermission$ = new BehaviorSubject<boolean>(true);

    permissionService = jasmine.createSpyObj('PermissionService', ['requestPermission']);
    permissionService.requestPermission.and.callFake(
      (request: PermissionRequest): Observable<boolean> =>
        request.action === 'complete' ? completePermission$.asObservable() : of(true)
    );

    processLinkService = jasmine.createSpyObj('ProcessLinkService', ['submitForm']);

    TestBed.configureTestingModule({
      imports: [TaskDetailContentComponent, TranslateModule.forRoot()],
      providers: [
        {provide: ConfigService, useValue: {featureToggles: {}}},
        {
          provide: DocumentService,
          useValue: {
            getProcessDefinitionCaseDefinitionFromProcessInstanceId: () =>
              of({id: {caseDefinitionId: {key: 'case-definition'}}}),
          },
        },
        {
          provide: GlobalNotificationService,
          useValue: jasmine.createSpyObj('GlobalNotificationService', ['showToast']),
        },
        {provide: IconService, useValue: jasmine.createSpyObj('IconService', ['registerAll'])},
        {provide: NGXLogger, useValue: jasmine.createSpyObj('NGXLogger', ['debug', 'error'])},
        {
          provide: ValtimoModalService,
          useValue: jasmine.createSpyObj('ValtimoModalService', ['setCaseDefinitionKey']),
        },
        {provide: PermissionService, useValue: permissionService},
        {provide: ProcessLinkService, useValue: processLinkService},
        {provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate'])},
        {
          provide: FormIoStateService,
          useValue: jasmine.createSpyObj('FormIoStateService', [
            'setDocumentId',
            'setProcessInstanceId',
            'setCaseDefinitionKey',
          ]),
        },
        {
          provide: TaskIntermediateSaveService,
          useValue: jasmine.createSpyObj('TaskIntermediateSaveService', ['setFormIoFormData']),
        },
        {
          provide: TaskService,
          useValue: jasmine.createSpyObj('TaskService', ['getTaskProcessLink']),
        },
        {provide: UrlResolverService, useValue: {}},
      ],
    });

    TestBed.overrideComponent(TaskDetailContentComponent, {
      set: {
        imports: [CommonModule, TranslateModule, FormIoStubComponent],
        schemas: [NO_ERRORS_SCHEMA],
      },
    });

    fixture = TestBed.createComponent(TaskDetailContentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the task form read-only when the complete permission is denied', () => {
    completePermission$.next(false);
    openTask();

    expect(renderedForm()?.readOnly).toBeTrue();
    expect(permissionService.requestPermission).toHaveBeenCalledWith(
      jasmine.objectContaining({action: 'complete'}),
      jasmine.objectContaining({identifier: task.id})
    );
  });

  it('renders the task form editable and completes the task on submit when the complete permission is granted', () => {
    processLinkService.submitForm.and.returnValue(of({} as any));
    const formSubmitSpy = spyOn(component.formSubmit, 'emit');
    openTask();

    const form = renderedForm();
    expect(form?.readOnly).toBeFalse();

    form?.submit.emit({data: {field: 'value'}});

    expect(processLinkService.submitForm).toHaveBeenCalledWith(
      'process-link-1',
      {field: 'value'},
      task.businessKey,
      task.id
    );
    expect(formSubmitSpy).toHaveBeenCalled();
  });

  it('keeps the task form read-only until the complete permission is answered', () => {
    completePermission$ = new Subject<boolean>();
    openTask();

    expect(renderedForm()?.readOnly).toBeTrue();

    completePermission$.next(true);
    fixture.detectChanges();

    expect(renderedForm()?.readOnly).toBeFalse();
  });

  it('re-renders the task form when a re-requested complete permission changes', () => {
    completePermission$.next(false);
    openTask();
    expect(renderedForm()?.readOnly).toBeTrue();
    const instancesBefore = FormIoStubComponent.instances;

    completePermission$ = new BehaviorSubject<boolean>(true);
    component.refreshCompleteTaskPermission();
    fixture.detectChanges();

    expect(renderedForm()?.readOnly).toBeFalse();
    expect(FormIoStubComponent.instances).toBe(instancesBefore + 1);
  });

  it('shows the task form read-only again when the same task is reopened until its answer arrives', () => {
    openTask();
    expect(renderedForm()?.readOnly).toBeFalse();

    completePermission$ = new Subject<boolean>();
    component.modalClosed = true;
    openTask();

    expect(renderedForm()?.readOnly).toBeTrue();
  });

  it('keeps the rendered task form when the same task is published again with an unchanged answer', () => {
    openTask();
    const form = renderedForm();
    const instancesBefore = FormIoStubComponent.instances;

    component.task = {...task, assignee: 'user-1'} as Task;
    component.refreshCompleteTaskPermission();
    fixture.detectChanges();

    expect(renderedForm()).toBe(form);
    expect(FormIoStubComponent.instances).toBe(instancesBefore);
  });
});
