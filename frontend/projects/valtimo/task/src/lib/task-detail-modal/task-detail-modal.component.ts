/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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
import {
  AfterViewInit,
  Component,
  EventEmitter,
  OnDestroy,
  Output,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import {Router} from '@angular/router';
import {FormioForm} from '@formio/angular';
import {TranslateService} from '@ngx-translate/core';
import {
  FormioComponent,
  FormioOptionsImpl,
  FormIoStateService,
  FormioSubmission,
  ModalComponent,
  ValtimoFormioOptions,
  ValtimoModalService,
} from '@valtimo/components';
import {DocumentService} from '@valtimo/document';
import {FormFlowComponent, FormSubmissionResult, ProcessLinkService} from '@valtimo/form-link';
import {UserProviderService} from '@valtimo/security';
import moment from 'moment';
import {ToastrService} from 'ngx-toastr';
import {BehaviorSubject, distinctUntilChanged, map, Observable, Subscription, tap} from 'rxjs';
import {Task, TaskProcessLinkType} from '../models';
import {TaskService} from '../task.service';
import {PermissionService} from '@valtimo/access-control';
import {CAN_ASSIGN_TASK_PERMISSION, TASK_DETAIL_PERMISSION_RESOURCE} from '../task-permissions';

moment.locale(localStorage.getItem('langKey') || '');

@Component({
  selector: 'valtimo-task-detail-modal',
  templateUrl: './task-detail-modal.component.html',
  styleUrls: ['./task-detail-modal.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class TaskDetailModalComponent implements AfterViewInit, OnDestroy {
  @ViewChild('form') form: FormioComponent;
  @ViewChild('formFlow') formFlow: FormFlowComponent;
  @ViewChild('taskDetailModal') modal: ModalComponent;
  @Output() formSubmit = new EventEmitter();
  @Output() assignmentOfTaskChanged = new EventEmitter();

  public canAssign$: Observable<boolean>;
  public errorMessage: string | null = null;
  public formDefinition: FormioForm | null;
  public formFlowInstanceId: string;
  public formIoFormData$ = new BehaviorSubject<any>(null);
  public formioOptions: ValtimoFormioOptions;
  public page: any = null;
  public task: Task | null = null;

  private _taskProcessLinkType$ = new BehaviorSubject<TaskProcessLinkType | null>(null);
  public processLinkIsForm$: Observable<boolean> = this._taskProcessLinkType$.pipe(
    map(type => type === 'form')
  );
  public processLinkIsFormFlow$: Observable<boolean> = this._taskProcessLinkType$.pipe(
    map(type => type === 'form-flow')
  );

  public readonly isAdmin$: Observable<boolean> = this.userProviderService
    .getUserSubject()
    .pipe(map(userIdentity => userIdentity?.roles?.includes('ROLE_ADMIN')));
  public readonly loading$ = new BehaviorSubject<boolean>(true);

  private _processLinkId: string | null;
  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly documentService: DocumentService,
    private readonly modalService: ValtimoModalService,
    private readonly permissionService: PermissionService,
    private readonly processLinkService: ProcessLinkService,
    private readonly router: Router,
    private readonly stateService: FormIoStateService,
    private readonly taskService: TaskService,
    private readonly toastr: ToastrService,
    private readonly translateService: TranslateService,
    private readonly userProviderService: UserProviderService
  ) {
    this.formioOptions = new FormioOptionsImpl();
    this.formioOptions.disableAlerts = true;
  }

  public ngAfterViewInit(): void {
    this._subscriptions.add(
      this.modal.modalShowing$
        .pipe(
          distinctUntilChanged(),
          tap(modalShowing => {
            if (!modalShowing) {
              if (this.formFlow) {
                this.formFlow.saveData();
              }
            }
          })
        )
        .subscribe()
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public openTaskDetails(task: Task): void {
    this.canAssign$ = this.permissionService.requestPermission(CAN_ASSIGN_TASK_PERMISSION, {
      resource: TASK_DETAIL_PERMISSION_RESOURCE.task,
      identifier: task.id,
    });
    this.resetTaskProcessLinkType();
    this.resetFormDefinition();
    this.getTaskProcessLink(task.id);
    this.setDocumentDefinitionNameInService(task);
    this.stateService.setDocumentId(task.businessKey);

    this.task = task;
    this.page = {
      title: task.name,
      subtitle: `${this.translateService.instant('taskDetail.taskCreated')} ${task.created}`,
    };

    if (!this._taskProcessLinkType$.getValue()) {
      this.modal.show();
    }
  }

  public gotoProcessLinkScreen(): void {
    this.modal.hide();
    this.router.navigate(['process-links']);
  }

  public onChange(event: any): void {
    if (event.data) {
      this.formIoFormData$.next(event.data);
    }
  }

  public completeTask(): void {
    this.toastr.success(
      `${this.task?.name} ${this.translateService.instant('taskDetail.taskCompleted')}`
    );
    this.modal.hide();
    this.task = null;
    this.formSubmit.emit();
  }

  public onSubmit(submission: FormioSubmission): void {
    if (submission.data) {
      this.formIoFormData$.next(submission.data);
    }

    if (this._taskProcessLinkType$.getValue() === 'form') {
      this.processLinkService
        .submitForm(
          this._processLinkId ?? '',
          submission.data,
          this.task?.businessKey,
          this.task?.id
        )
        .subscribe({
          next: (_: FormSubmissionResult) => {
            this.completeTask();
          },
          error: errors => {
            this.form.showErrors(errors);
          },
        });
    }
  }

  private resetFormDefinition(): void {
    this.formDefinition = null;
    this.loading$.next(true);
  }

  private getTaskProcessLink(taskId: string): void {
    this.taskService.getTaskProcessLink(taskId).subscribe({
      next: res => {
        if (res != null) {
          switch (res?.type) {
            case 'form':
              this._taskProcessLinkType$.next('form');
              this._processLinkId = res.processLinkId;
              this.setFormDefinitionAndOpenModal(res.properties.prefilledForm);
              break;
            case 'form-flow':
              this._taskProcessLinkType$.next('form-flow');
              this.formFlowInstanceId = res.properties.formFlowInstanceId ?? '';
              break;
          }
          this.loading$.next(false);
        } else {
          this.getLegacyTaskProcessLink(taskId);
        }
      },
      error: _ => {
        this.getLegacyTaskProcessLink(taskId);
      },
    });
  }

  private getLegacyTaskProcessLink(taskId: string): void {
    this.taskService.getTaskProcessLinkV1(taskId).subscribe(resV1 => {
      switch (resV1?.type) {
        case 'form':
          this._taskProcessLinkType$.next('form');
          break;
        case 'form-flow':
          this._taskProcessLinkType$.next('form-flow');
          this.formFlowInstanceId = resV1.properties.formFlowInstanceId ?? '';
          break;
      }
      this.loading$.next(false);
    });
  }

  private resetTaskProcessLinkType(): void {
    this._taskProcessLinkType$.next(null);
    this._processLinkId = null;
  }

  private setFormDefinitionAndOpenModal(formDefinition: any): void {
    this._taskProcessLinkType$.next('form');
    this.formDefinition = formDefinition;
    this.modal.show();
  }

  private setDocumentDefinitionNameInService(task: Task): void {
    this.documentService
      .getProcessDocumentDefinitionFromProcessInstanceId(task.processInstanceId)
      .subscribe(processDocumentDefinition => {
        const documentDefinitionName = processDocumentDefinition.id.documentDefinitionId.name;
        this.modalService.setDocumentDefinitionName(documentDefinitionName);
        this.stateService.setDocumentDefinitionName(documentDefinitionName);
      });
  }
}
