/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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
import {ActivatedRoute, Router} from '@angular/router';
import {
  FormioComponent,
  FormioOptionsImpl,
  FormioSubmission,
  ModalComponent,
  ValtimoFormioOptions,
  ValtimoModalService,
} from '@valtimo/components';
import {Task, TaskProcessLinkType} from '../models';
import {
  FormAssociation,
  FormFlowInstance,
  FormFlowService,
  FormFlowStepType,
  FormLinkService,
  FormSubmissionResult,
} from '@valtimo/form-link';
import {FormioForm} from '@formio/angular';
import moment from 'moment';
import {NGXLogger} from 'ngx-logger';
import {ToastrService} from 'ngx-toastr';
import {map, take} from 'rxjs/operators';
import {TaskService} from '../task.service';
import {BehaviorSubject, distinctUntilChanged, Observable, Subscription, tap} from 'rxjs';
import {UserProviderService} from '@valtimo/security';
import {DocumentService} from '@valtimo/document';
import {TranslateService} from '@ngx-translate/core';

moment.locale(localStorage.getItem('langKey') || '');

@Component({
  selector: 'valtimo-task-detail-modal',
  templateUrl: './task-detail-modal.component.html',
  styleUrls: ['./task-detail-modal.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class TaskDetailModalComponent implements AfterViewInit, OnDestroy {
  @ViewChild('form') form: FormioComponent;
  @ViewChild('taskDetailModal') modal: ModalComponent;
  @Output() formSubmit = new EventEmitter();
  @Output() assignmentOfTaskChanged = new EventEmitter();

  public task: Task | null = null;
  public formDefinition: FormioForm;
  public formFlowInstanceId: string;
  public formFlowStepInstanceId?: string;
  public page: any = null;
  public formioOptions: ValtimoFormioOptions;
  public errorMessage: string = null;
  readonly isAdmin$: Observable<boolean> = this.userProviderService
    .getUserSubject()
    .pipe(map(userIdentity => userIdentity?.roles?.includes('ROLE_ADMIN')));
  private formAssociation: FormAssociation;
  private taskProcessLinkType$ = new BehaviorSubject<TaskProcessLinkType | null>(null);
  processLinkIsForm$ = this.taskProcessLinkType$.pipe(map(type => type === 'form'));
  processLinkIsFormFlow$ = this.taskProcessLinkType$.pipe(map(type => type === 'form-flow'));
  private formFlowStepType$ = new BehaviorSubject<FormFlowStepType | null>(null);
  formFlowStepTypeIsForm$ = this.formFlowStepType$.pipe(map(type => type === 'form'));
  private formIoFormData$ = new BehaviorSubject<any>(null);
  private _subscriptions = new Subscription();

  constructor(
    private readonly toastr: ToastrService,
    private readonly formLinkService: FormLinkService,
    private readonly formFlowService: FormFlowService,
    private readonly router: Router,
    private readonly logger: NGXLogger,
    private readonly route: ActivatedRoute,
    private readonly taskService: TaskService,
    private readonly userProviderService: UserProviderService,
    private readonly modalService: ValtimoModalService,
    private readonly documentService: DocumentService,
    private readonly translateService: TranslateService
  ) {
    this.formioOptions = new FormioOptionsImpl();
    this.formioOptions.disableAlerts = true;
  }

  ngAfterViewInit() {
    this._subscriptions.add(
      this.modal.modalShowing$
        .pipe(
          distinctUntilChanged(),
          tap(modalShowing => {
            const formIoFormData = this.formIoFormData$.getValue();
            if (!modalShowing && formIoFormData) {
              if (this.taskProcessLinkType$.getValue() === 'form-flow') {
                this.formFlowService.save(this.formFlowInstanceId, formIoFormData).subscribe(
                  () => null,
                  errors => this.form.showErrors(errors)
                );
              }
            }
          })
        )
        .subscribe()
    );
  }

  ngOnDestroy() {
    this._subscriptions.unsubscribe();
  }

  openTaskDetails(task: Task) {
    this.resetTaskProcessLinkType();
    this.resetFormDefinition();
    this.getTaskProcessLink(task.id);
    this.setDocumentDefinitionNameInService(task);

    this.task = task;
    this.page = {
      title: task.name,
      subtitle: `${this.translateService.instant('taskDetail.taskCreated')} ${task.created}`,
    };

    this.formLinkService
      .getPreFilledFormDefinitionByFormLinkId(
        task.processDefinitionKey,
        task.businessKey,
        task.taskDefinitionKey,
        task.id // taskInstanceId
      )
      .subscribe(
        formDefinition => {
          this.formAssociation = formDefinition.formAssociation;

          const className = this.formAssociation.formLink.className.split('.');
          const linkType = className[className.length - 1];

          switch (linkType) {
            case 'BpmnElementFormIdLink':
              this.setFormDefinitionAndOpenModal(formDefinition);
              break;
            case 'BpmnElementFormFlowIdLink':
              // We can't use the formDefinition here because the form definition is provided per form flow step
              // I'm still leaving this in here in case we want to add form flow specific code.
              break;
            case 'BpmnElementUrlLink':
              this.openUrlLink(formDefinition);
              break;
            case 'BpmnElementAngularStateUrlLink':
              this.openAngularStateUrlLink(task, formDefinition);
              break;
            default:
              this.logger.fatal('Unsupported class name');
          }
        },
        errors => {
          if (errors?.error?.detail) {
            this.errorMessage = errors.error.detail;
          }

          this.modal.show();
        }
      );
  }

  public gotoFormLinkScreen(): void {
    this.modal.hide();
    this.router.navigate(['form-links']);
  }

  public onChange(event: any): void {
    if (event.data) {
      this.formIoFormData$.next(event.data);
    }
  }

  public onSubmit(submission: FormioSubmission): void {
    if (submission.data) {
      this.formIoFormData$.next(submission.data);
    }
    if (this.taskProcessLinkType$.getValue() === 'form') {
      this.formLinkService
        .onSubmit(
          this.task.processDefinitionKey,
          this.formAssociation.formLink.id,
          submission.data,
          this.task.businessKey,
          this.task.id
        )
        .subscribe(
          (_: FormSubmissionResult) => {
            this.completeTask();
          },
          errors => {
            this.form.showErrors(errors);
          }
        );
    }

    if (this.taskProcessLinkType$.getValue() === 'form-flow') {
      if (submission.data.submit) {
        this.formFlowService
          .submitStep(this.formFlowInstanceId, this.formFlowStepInstanceId, submission.data)
          .subscribe(
            (result: FormFlowInstance) => this.handleFormFlowStep(result),
            errors => this.form.showErrors(errors)
          );
      } else if (submission.data['back']) {
        this.formFlowService.back(this.formFlowInstanceId, submission.data).subscribe(
          (result: FormFlowInstance) => this.handleFormFlowStep(result),
          errors => this.form.showErrors(errors)
        );
      }
    }
  }

  private resetFormDefinition(): void {
    this.formDefinition = null;
  }

  private getTaskProcessLink(taskId: string): void {
    this.taskService.getTaskProcessLink(taskId).subscribe(res => {
      switch (res?.type) {
        case 'form':
          this.taskProcessLinkType$.next('form');
          break;
        case 'form-flow':
          this.taskProcessLinkType$.next('form-flow');
          this.getFormFlowStep(res?.properties.formFlowInstanceId);
          break;
      }
    });
  }

  private getFormFlowStep(formFlowInstanceId: string): void {
    this.formFlowService
      .getFormFlowStep(formFlowInstanceId)
      .subscribe((result: FormFlowInstance) => {
        this.handleFormFlowStep(result);
      });
  }

  private handleFormFlowStep(formFlowInstance: FormFlowInstance) {
    if (formFlowInstance.step === null) {
      this.formFlowStepType$.next(null);
      this.formFlowInstanceId = null;
      this.formFlowStepInstanceId = null;
      this.completeTask();
    } else {
      this.modalService.scrollToTop();
      this.formFlowStepType$.next(formFlowInstance.step.type);
      this.formFlowInstanceId = formFlowInstance.id;
      this.formFlowStepInstanceId = formFlowInstance.step.id;
      this.setFormDefinitionAndOpenModal(formFlowInstance.step.typeProperties.definition);
    }
  }

  private completeTask() {
    this.toastr.success(
      `${this.task.name} ${this.translateService.instant('taskDetail.taskCompleted')}`
    );
    this.modal.hide();
    this.task = null;
    this.formSubmit.emit();
  }

  private resetTaskProcessLinkType(): void {
    this.taskProcessLinkType$.next(null);
  }

  private setFormDefinitionAndOpenModal(formDefinition: any): void {
    this.formDefinition = formDefinition;
    this.modal.show();
  }

  private openUrlLink(formDefinition: any): void {
    const url = this.router.serializeUrl(
      this.router.createUrlTree([formDefinition.formAssociation.formLink.url])
    );

    window.open(url, '_blank');
  }

  private openAngularStateUrlLink(task: Task, formDefinition: any): void {
    this.route.params.pipe(take(1)).subscribe(params => {
      const taskId = task?.id;
      const documentId = params?.documentId;

      this.router.navigate([formDefinition.formAssociation.formLink.url], {
        state: {
          ...(taskId && {taskId}),
          ...(documentId && {documentId}),
        },
      });
    });
  }

  private setDocumentDefinitionNameInService(task: Task): void {
    this.documentService
      .getProcessDocumentDefinitionFromProcessInstanceId(task.processInstanceId)
      .subscribe(processDocumentDefinition => {
        this.modalService.setDocumentDefinitionName(
          processDocumentDefinition.id.documentDefinitionId.name
        );
      });
  }
}
