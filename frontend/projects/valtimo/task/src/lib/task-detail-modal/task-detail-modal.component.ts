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
import {ActivatedRoute, Router} from '@angular/router';
import {
  FormioComponent,
  FormioOptionsImpl,
  FormIoStateService,
  FormioSubmission,
  ModalComponent,
  ValtimoFormioOptions,
  ValtimoModalService,
} from '@valtimo/components';
import {Task, TaskProcessLinkType} from '../models';
import {
  FormAssociation,
  FormFlowComponent,
  FormFlowService,
  FormLinkService,
  FormSubmissionResult,
  ProcessLinkService,
} from '@valtimo/form-link';
import {FormioForm} from '@formio/angular';
import moment from 'moment';
import {NGXLogger} from 'ngx-logger';
import {ToastrService} from 'ngx-toastr';
import {map, take} from 'rxjs/operators';
import {TaskService} from '../task.service';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  Observable,
  Subscription,
  tap,
} from 'rxjs';
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
  @ViewChild('formFlow') formFlow: FormFlowComponent;
  @ViewChild('taskDetailModal') modal: ModalComponent;
  @Output() formSubmit = new EventEmitter();
  @Output() assignmentOfTaskChanged = new EventEmitter();

  public readonly task$ = new BehaviorSubject<Task | null>(null);
  public readonly formDefinition$ = new BehaviorSubject<FormioForm>(undefined);
  public readonly formFlowInstanceId$ = new BehaviorSubject<string>(undefined);
  public readonly page$ = new BehaviorSubject<any>(null);
  public readonly formioOptions$ = new BehaviorSubject<ValtimoFormioOptions>(null);
  public readonly errorMessage$ = new BehaviorSubject<string>(undefined);
  public readonly isAdmin$: Observable<boolean> = this.userProviderService
    .getUserSubject()
    .pipe(map(userIdentity => userIdentity?.roles?.includes('ROLE_ADMIN')));
  public readonly formIoFormData$ = new BehaviorSubject<any>(null);
  public readonly loading$ = new BehaviorSubject<boolean>(true);

  private readonly taskProcessLinkType$ = new BehaviorSubject<TaskProcessLinkType | null>(null);
  public readonly processLinkIsForm$ = this.taskProcessLinkType$.pipe(map(type => type === 'form'));
  public readonly processLinkIsFormFlow$ = this.taskProcessLinkType$.pipe(
    map(type => type === 'form-flow')
  );

  private readonly formAssociation$ = new BehaviorSubject<FormAssociation>(undefined);
  private readonly processLinkId$ = new BehaviorSubject<string>(undefined);

  private _subscriptions = new Subscription();

  constructor(
    private readonly toastr: ToastrService,
    private readonly formLinkService: FormLinkService,
    private readonly processLinkService: ProcessLinkService,
    private readonly formFlowService: FormFlowService,
    private readonly router: Router,
    private readonly logger: NGXLogger,
    private readonly route: ActivatedRoute,
    private readonly taskService: TaskService,
    private readonly userProviderService: UserProviderService,
    private readonly modalService: ValtimoModalService,
    private readonly stateService: FormIoStateService,
    private readonly documentService: DocumentService,
    private readonly translateService: TranslateService
  ) {
    const options = new FormioOptionsImpl();
    options.disableAlerts = true;
    this.formioOptions$.next(options);
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
    this.resetTaskProcessLinkType();
    this.resetFormDefinition();
    this.getTaskProcessLink(task.id);
    this.setDocumentDefinitionNameInService(task);
    const documentId = task.businessKey;
    this.stateService.setDocumentId(documentId);

    this.task$.next(task);
    this.page$.next({
      title: task.name,
      subtitle: `${this.translateService.instant('taskDetail.taskCreated')} ${task.created}`,
    });

    //only load from formlink when process link failed for backwards compatibility
    if (!this.taskProcessLinkType$.getValue()) {
      this.formLinkService
        .getPreFilledFormDefinitionByFormLinkId(
          task.processDefinitionKey,
          documentId,
          task.taskDefinitionKey,
          task.id // taskInstanceId
        )
        .subscribe(
          formDefinition => {
            this.formAssociation$.next(formDefinition.formAssociation);

            const className = formDefinition.formAssociation.formLink.className.split('.');
            const linkType = className[className.length - 1];

            switch (linkType) {
              case 'BpmnElementFormIdLink':
                this.setFormDefinitionAndOpenModal(formDefinition);
                break;
              case 'BpmnElementFormFlowIdLink':
                // We can't use the formDefinition here because the form definition is provided per form flow step
                // I'm still leaving this in here in case we want to add form flow specific code.
                this.modal.show();
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
              this.errorMessage$.next(errors.error.detail);
            }

            this.modal.show();
          }
        );
    }
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

    combineLatest([
      this.processLinkId$,
      this.taskProcessLinkType$,
      this.task$,
      this.formAssociation$,
    ])
      .pipe(take(1))
      .subscribe(([processLinkId, taskProcessLinkType, task, formAssociation]) => {
        if (taskProcessLinkType === 'form') {
          if (processLinkId) {
            this.processLinkService
              .submitForm(processLinkId, submission.data, task.businessKey, task.id)
              .subscribe({
                next: (_: FormSubmissionResult) => {
                  this.completeTask();
                },
                error: errors => {
                  this.form.showErrors(errors);
                },
              });
          } else {
            this.formLinkService
              .onSubmit(
                task.processDefinitionKey,
                formAssociation.formLink.id,
                submission.data,
                task.businessKey,
                task.id
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
        }
      });
  }

  public completeTask(): void {
    this.task$.pipe(take(1)).subscribe(task => {
      this.toastr.success(
        `${task.name} ${this.translateService.instant('taskDetail.taskCompleted')}`
      );
      this.modal.hide();
      this.task$.next(null);
      this.formSubmit.emit();
    });
  }

  private resetFormDefinition(): void {
    this.formDefinition$.next(null);
    this.loading$.next(true);
  }

  private getTaskProcessLink(taskId: string): void {
    this.taskService.getTaskProcessLink(taskId).subscribe({
      next: res => {
        if (res != null) {
          switch (res?.type) {
            case 'form':
              this.taskProcessLinkType$.next('form');
              this.processLinkId$.next(res.processLinkId);
              this.setFormDefinitionAndOpenModal(res.properties.prefilledForm);
              break;
            case 'form-flow':
              this.taskProcessLinkType$.next('form-flow');
              this.formFlowInstanceId$.next(res.properties.formFlowInstanceId);
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
          this.taskProcessLinkType$.next('form');
          break;
        case 'form-flow':
          this.taskProcessLinkType$.next('form-flow');
          this.formFlowInstanceId$.next(resV1.properties.formFlowInstanceId);
          break;
      }
      this.loading$.next(false);
    });
  }

  private resetTaskProcessLinkType(): void {
    this.taskProcessLinkType$.next(null);
    this.processLinkId$.next(null);
    this.formAssociation$.next(null);
  }

  private setFormDefinitionAndOpenModal(formDefinition: any): void {
    this.taskProcessLinkType$.next('form');
    this.formDefinition$.next(formDefinition);
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
        const documentDefinitionName = processDocumentDefinition.id.documentDefinitionId.name;
        this.modalService.setDocumentDefinitionName(documentDefinitionName);
        this.stateService.setDocumentDefinitionName(documentDefinitionName);
      });
  }
}
