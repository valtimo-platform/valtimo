/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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
  Inject,
  OnDestroy,
  Optional,
  Output,
  ViewChild,
  ViewContainerRef,
  ViewEncapsulation,
  Renderer2,
  ChangeDetectorRef,
} from '@angular/core';
import {Router} from '@angular/router';
import {
  FormioComponent,
  FormioOptionsImpl,
  FormIoStateService,
  FormioSubmission,
  ModalComponent,
  ValtimoFormioOptions,
  ValtimoModalService,
} from '@valtimo/components';
import {Task, TaskProcessLinkType} from '../../models';
import {FormFlowComponent, FormSubmissionResult, ProcessLinkService} from '@valtimo/process-link';
import {FormioForm} from '@formio/angular';
import moment from 'moment';
import {ToastrService} from 'ngx-toastr';
import {filter, map, take} from 'rxjs/operators';
import {TaskService} from '../../services/task.service';
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
import {FORM_VIEW_MODEL_TOKEN, FormViewModel} from '@valtimo/config';

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
  @ViewChild('formViewModelComponent', {static: true, read: ViewContainerRef})
  public formViewModelDynamicContainer: ViewContainerRef;
  @Output() formSubmit = new EventEmitter();
  @Output() assignmentOfTaskChanged = new EventEmitter();

  public readonly task$ = new BehaviorSubject<Task | null>(null);
  public readonly taskInstanceId$ = new BehaviorSubject<string>(null);
  public readonly formDefinition$ = new BehaviorSubject<FormioForm>(undefined);
  public readonly formDefinitionId$ = new BehaviorSubject<string>(undefined);
  public readonly formName$ = new BehaviorSubject<string>(undefined);
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
  public readonly processLinkIsFormViewModel$ = this.taskProcessLinkType$.pipe(
    map(type => type === 'form-view-model')
  );
  public readonly processLinkIsFormFlow$ = this.taskProcessLinkType$.pipe(
    map(type => type === 'form-flow')
  );

  private readonly processLinkId$ = new BehaviorSubject<string>(undefined);

  private _subscriptions = new Subscription();

  constructor(
    private readonly toastr: ToastrService,
    private readonly processLinkService: ProcessLinkService,
    private readonly router: Router,
    private readonly taskService: TaskService,
    private readonly userProviderService: UserProviderService,
    private readonly modalService: ValtimoModalService,
    private readonly stateService: FormIoStateService,
    private readonly documentService: DocumentService,
    private readonly translateService: TranslateService,
    @Optional() @Inject(FORM_VIEW_MODEL_TOKEN) private readonly formViewModel: FormViewModel
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
    this.taskInstanceId$.next(task.id);
    this.page$.next({
      title: task.name,
      subtitle: `${this.translateService.instant('taskDetail.taskCreated')} ${task.created}`,
    });

    //only load from formlink when process link failed for backwards compatibility
    if (!this.taskProcessLinkType$.getValue()) {
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

  public onSubmit(submission: FormioSubmission): void {
    if (submission.data) {
      this.formIoFormData$.next(submission.data);
    }

    combineLatest([this.processLinkId$, this.taskProcessLinkType$, this.task$])
      .pipe(take(1))
      .subscribe(([processLinkId, taskProcessLinkType, task]) => {
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
          }
        } else if (taskProcessLinkType === 'form-view-model') {
          this.completeTask();
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
            case 'form-view-model':
              this.taskProcessLinkType$.next('form-view-model');
              this.processLinkId$.next(res.processLinkId);
              this.formDefinition$.next(res.properties.formDefinition);
              this.formName$.next(res.properties.formName);
              this.modal.show();
              this.setFormViewModelComponent();
              break;
          }
          this.loading$.next(false);
        }
      },
      error: _ => {
        this.loading$.next(false);
      },
    });
  }

  private resetTaskProcessLinkType(): void {
    this.taskProcessLinkType$.next(null);
    this.processLinkId$.next(null);
  }

  private setFormDefinitionAndOpenModal(formDefinition: any): void {
    this.taskProcessLinkType$.next('form');
    this.formDefinition$.next(formDefinition);
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

  private setFormViewModelComponent() {
    if (!this.formViewModel) return;
    this.formViewModelDynamicContainer.clear();
    const formViewModelComponent = this.formViewModelDynamicContainer.createComponent(
      this.formViewModel.component
    );
    formViewModelComponent.instance.form = this.formDefinition$.getValue();
    formViewModelComponent.instance.formName = this.formName$.getValue();
    formViewModelComponent.instance.taskInstanceId = this.taskInstanceId$.getValue();
    formViewModelComponent.instance.isStartForm = false;
    this._subscriptions.add(
      formViewModelComponent.instance.formSubmit.subscribe(() => {
        this.completeTask();
        this.modal.hide();
      })
    );
  }
}
