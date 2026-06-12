/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
import {CommonModule} from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  EventEmitter,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  Optional,
  Output,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import {Router} from '@angular/router';
import {RecentlyViewed16} from '@carbon/icons';
import {FormioForm} from '@formio/angular';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {PermissionService} from '@valtimo/access-control';
import {
  FormioComponent,
  FormIoModule,
  FormioOptionsImpl,
  FormIoStateService,
  FormioSubmission,
  ValtimoFormioOptions,
  ValtimoModalService,
} from '@valtimo/components';
import {
  ConfigService,
  FORM_VIEW_MODEL_TOKEN,
  FormViewModel,
  GlobalNotificationService,
} from '@valtimo/shared';
import {DocumentService} from '@valtimo/document';
import {
  FORM_CUSTOM_COMPONENT_TOKEN,
  FormCustomComponent,
  FormCustomComponentConfig,
  FormFlowComponent,
  FormSubmissionResult,
  ProcessLinkModule,
  ProcessLinkService,
  TaskProcessLinkResult,
  TaskProcessLinkType,
  TaskWithProcessLink,
  UrlResolverService,
} from '@valtimo/process-link';
import {
  IconService,
  LoadingModule,
  NotificationContent,
  NotificationModule,
} from 'carbon-components-angular';
import {NGXLogger} from 'ngx-logger';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  Observable,
  Subscription,
  switchMap,
  take,
} from 'rxjs';
import {IntermediateSubmission, Task} from '../../models';
import {TaskIntermediateSaveService, TaskService} from '../../services';
import {CAN_ASSIGN_TASK_PERMISSION, TASK_DETAIL_PERMISSION_RESOURCE} from '../../task-permissions';
import {enrichTaskFromProcessLink} from '../../utils/task-enrichment.utils';

@Component({
  selector: 'valtimo-task-detail-content',
  templateUrl: './task-detail-content.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormIoModule,
    TranslateModule,
    ProcessLinkModule,
    LoadingModule,
    NotificationModule,
  ],
})
export class TaskDetailContentComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('form') form!: FormioComponent;
  @ViewChild('formViewModelComponent', {static: false, read: ViewContainerRef})
  public formViewModelDynamicContainer!: ViewContainerRef;
  @ViewChild('formFlow') public formFlow!: FormFlowComponent;
  @ViewChild('formCustomComponent', {static: false, read: ViewContainerRef})
  public formCustomComponentDynamicContainer!: ViewContainerRef;
  @Input() public set task(value: Task | null) {
    if (!value) return;

    if (this.taskInstanceId$.getValue() === value.id) {
      this.task$.next(value);
      return;
    }
    this.loadTaskDetails(value);
  }
  @Input() public set taskAndProcessLink(value: TaskWithProcessLink | null) {
    if (!value) return;

    const task = enrichTaskFromProcessLink(value.task as any as Task, value.processLinkActivityResult);
    this.loadTaskDetails(task, value.processLinkActivityResult);
  }
  @Input() public set modalClosed(closed: boolean) {
    // save form flow data on modal closed
    if (this.formFlow) this.formFlow.saveData();
    this.taskInstanceId$.next(null);

    if (closed) {
      this.closeModalEvent.emit();
    }
  }
  @Output() public readonly closeModalEvent = new EventEmitter();
  @Output() public readonly formSubmit = new EventEmitter();
  @Output() public readonly activeChange = new EventEmitter<boolean>();
  @Output() public readonly taskUpdated = new EventEmitter<Task>();

  public readonly canAssignUserToTask$ = new BehaviorSubject<boolean>(false);
  public readonly errorMessage$ = new BehaviorSubject<string | null>(null);
  public readonly formDefinition$ = new BehaviorSubject<FormioForm | null>(null);
  public readonly formDefinitionId$ = new BehaviorSubject<string | null>(null);
  public readonly formFlowInstanceId$ = new BehaviorSubject<string | null>(null);
  public readonly formioOptions$ = new BehaviorSubject<ValtimoFormioOptions | null>(null);
  public readonly formIoFormData$ = new BehaviorSubject<any>(null);
  public readonly formName$ = new BehaviorSubject<string | null>(null);
  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly submission$ = new BehaviorSubject<any>(null);
  public readonly task$ = new BehaviorSubject<Task | null>(null);
  public readonly taskInstanceId$ = new BehaviorSubject<string | null>(null);
  public get intermediateSaveEnabled(): boolean {
    return !!this.configService.featureToggles?.enableIntermediateSave;
  }

  private readonly _taskProcessLinkType$ = new BehaviorSubject<TaskProcessLinkType | null>(null);
  public readonly processLinkIsForm$ = this._taskProcessLinkType$.pipe(
    map((type: string | null) => type === 'form')
  );
  public readonly processLinkIsFormViewModel$ = this._taskProcessLinkType$.pipe(
    map((type: string | null) => type === 'form-view-model')
  );
  public readonly processLinkIsFormFlow$ = this._taskProcessLinkType$.pipe(
    map((type: string | null) => type === 'form-flow')
  );
  public readonly processLinkIsUiComponent$ = this._taskProcessLinkType$.pipe(
    map((type: string | null) => type === 'ui-component')
  );

  public readonly noFormNotification$: Observable<NotificationContent | null> = combineLatest([
    this.loading$,
    this.formDefinition$,
    this.formFlowInstanceId$,
    this.errorMessage$,
    this.processLinkIsUiComponent$,
    this.processLinkIsFormViewModel$,
  ]).pipe(
    map(
      ([
        loading,
        formDefinition,
        formFlowInstanceId,
        errorMessage,
        isUiComponent,
        isFormViewModel,
      ]) => {
        if (
          !loading &&
          !formDefinition &&
          !formFlowInstanceId &&
          !errorMessage &&
          !isUiComponent &&
          !isFormViewModel
        ) {
          return {
            type: 'warning',
            title: this.translateService.instant('interface.warning'),
            message: this.translateService.instant('formManagement.noFormDefinitionFoundUser'),
            showClose: false,
            lowContrast: true,
          } as NotificationContent;
        }
        return null;
      }
    )
  );

  private readonly _processLinkId$ = new BehaviorSubject<string | null>(null);
  private readonly _subscriptions = new Subscription();
  private readonly _formCustomComponentConfig$ = new BehaviorSubject<
    FormCustomComponentConfig | {}
  >({});

  private readonly _viewInitialized$ = new BehaviorSubject<boolean>(false);

  public get viewInitialized$(): Observable<boolean> {
    return this._viewInitialized$.pipe(filter(initialized => initialized));
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly documentService: DocumentService,
    private readonly globalNotificationService: GlobalNotificationService,
    private readonly iconService: IconService,
    private readonly logger: NGXLogger,
    private readonly modalService: ValtimoModalService,
    private readonly permissionService: PermissionService,
    private readonly processLinkService: ProcessLinkService,
    private readonly router: Router,
    private readonly stateService: FormIoStateService,
    private readonly taskIntermediateSaveService: TaskIntermediateSaveService,
    private readonly taskService: TaskService,
    private readonly translateService: TranslateService,
    @Optional() @Inject(FORM_VIEW_MODEL_TOKEN) private readonly formViewModel: FormViewModel,
    @Optional()
    @Inject(FORM_CUSTOM_COMPONENT_TOKEN)
    private readonly formCustomComponentConfig: FormCustomComponentConfig,
    private readonly urlResolverService: UrlResolverService
  ) {
    this.iconService.registerAll([RecentlyViewed16]);

    const options = new FormioOptionsImpl();
    options.disableAlerts = true;
    this.formioOptions$.next(options);
    this._formCustomComponentConfig$.next(formCustomComponentConfig);
  }
  public ngOnInit(): void {
    this.openPermissionSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this.submission$.next(null);
    this._viewInitialized$.next(false);
  }

  public ngAfterViewInit(): void {
    this._viewInitialized$.next(true);
  }

  public onSubmit(submission: FormioSubmission): void {
    if (submission.data) {
      this.taskIntermediateSaveService.setFormIoFormData(submission.data);
      this.formIoFormData$.next(submission.data);
    }

    combineLatest([this._processLinkId$, this._taskProcessLinkType$, this.task$])
      .pipe(take(1))
      .subscribe(([processLinkId, taskProcessLinkType, task]) => {
        if (taskProcessLinkType === 'form') {
          if (processLinkId) {
            this.processLinkService
              .submitForm(processLinkId, submission.data, task?.businessKey, task?.id)
              .subscribe({
                next: (_: FormSubmissionResult) => {
                  this.completeTask(task);
                },
                error: errors => {
                  this.form.showErrors(errors);
                },
              });
          }
        } else if (taskProcessLinkType === 'form-view-model') {
          this.completeTask(task);
        }
      });
  }

  public completeTask(task: Task | null): void {
    if (!task) return;

    this.globalNotificationService.showToast({
      title: `${task.name} ${this.translateService.instant('taskDetail.taskCompleted')}`,
      type: 'success',
    });
    this.task$.next(null);
    this.formSubmit.emit();
    this.closeModalEvent.emit();
    this.activeChange.emit(false);

    if (this.formFlow) this.formFlow.saveData();
  }

  public onChange(event: any): void {
    if (event.data) {
      this.taskIntermediateSaveService.setFormIoFormData(event.data);
      this.formIoFormData$.next(event.data);
      this.activeChange.emit(true);
    }
  }

  public onFormFlowChangeEvent(): void {
    this.activeChange.emit(true);
  }

  private loadTaskDetails(task: Task, processLink?: TaskProcessLinkResult): void {
    this.resetTaskProcessLinkType();
    this.resetFormDefinition();

    this.taskInstanceId$.next(task.id);

    if (!processLink) {
      this.getTaskProcessLink(task.id);
    } else {
      this.setTaskProcessLink(processLink);
    }

    this.setDocumentDefinitionNameInService(task);
    const documentId = task.businessKey;
    this.stateService.setDocumentId(documentId);

    this.task$.next(task);
    this.stateService.setProcessInstanceId(task.processInstanceId);
  }

  private getCurrentProgress(formViewModelComponentRef?: ComponentRef<any>): void {
    this.taskInstanceId$
      .pipe(
        filter(value => !!value),
        take(1),
        switchMap((taskInstanceId: string | null) =>
          this.taskIntermediateSaveService.getIntermediateSubmission(taskInstanceId ?? '')
        )
      )
      .subscribe({
        next: (intermediateSubmission: IntermediateSubmission) => {
          this.taskIntermediateSaveService.setSubmission({
            data: intermediateSubmission?.submission || {},
          });

          if (formViewModelComponentRef) {
            formViewModelComponentRef.instance.submission = {
              data: intermediateSubmission.submission,
            };
          }
        },
      });
  }

  private getTaskProcessLink(taskId: string): void {
    this.taskService.getTaskProcessLink(taskId).subscribe({
      next: res => {
        this.updateTaskFromProcessLink(res);
        this.setTaskProcessLink(res);
      },
      error: _ => {
        this.loading$.next(false);
      },
    });
  }

  private updateTaskFromProcessLink(processLinkResult: TaskProcessLinkResult | null): void {
    const currentTask = this.task$.getValue();
    if (!currentTask) return;

    const enrichedTask = enrichTaskFromProcessLink(currentTask, processLinkResult);
    if (enrichedTask !== currentTask) {
      this.task$.next(enrichedTask);
      this.taskUpdated.emit(enrichedTask);
    }
  }

  private setTaskProcessLink(processLinkResult: TaskProcessLinkResult | null): void {
    if (processLinkResult !== null) {
      switch (processLinkResult?.type) {
        case 'form':
          this._taskProcessLinkType$.next('form');
          this._processLinkId$.next(processLinkResult.processLinkId);
          // initializeFormWithSubmission will set loading to false after form is ready
          this.initializeFormWithSubmission(processLinkResult.properties.prefilledForm);
          break;
        case 'form-flow':
          this._taskProcessLinkType$.next('form-flow');
          this.formFlowInstanceId$.next(processLinkResult.properties.formFlowInstanceId ?? '');
          this.loading$.next(false);
          break;
        case 'form-view-model':
          this._taskProcessLinkType$.next('form-view-model');
          this._processLinkId$.next(processLinkResult.processLinkId);
          this.formDefinition$.next(processLinkResult.properties.formDefinition);
          this.formName$.next(processLinkResult.properties.formName ?? '');
          this.setFormViewModelComponent(
            processLinkResult.properties.formDefinition,
            processLinkResult.properties.formName ?? '',
            this.taskInstanceId$.getValue()
          );
          this.loading$.next(false);
          break;
        case 'url':
          this._taskProcessLinkType$.next('url');
          this._processLinkId$.next(processLinkResult.processLinkId);
          combineLatest([this.processLinkService.getVariables(), this.task$])
            .pipe(take(1))
            .subscribe(([variables, task]) => {
              let url = this.urlResolverService.resolveUrlVariables(
                processLinkResult.properties.url!,
                variables.variables
              );
              window.open(url, '_blank')!.focus();
              this.processLinkService
                .submitURLProcessLink(processLinkResult.processLinkId, task!.businessKey, task!.id)
                .subscribe(() => {
                  this.completeTask(task!);
                });
            });
          this.loading$.next(false);
          break;
        case 'ui-component':
          this._taskProcessLinkType$.next('ui-component');
          this._processLinkId$.next(processLinkResult.processLinkId);
          this.formDefinition$.next(null);
          this.formName$.next('');
          this.setFormCustomComponent(
            processLinkResult.properties.componentKey!,
            this.taskInstanceId$.getValue()
          );
          this.loading$.next(false);
          break;
      }
    }
  }

  private openPermissionSubscription(): void {
    this._subscriptions.add(
      this.task$.subscribe(task => {
        if (task) {
          this.logger.debug('Checking if user allowed to assign a user to Task with id:', task.id);
          this.permissionService
            .requestPermission(CAN_ASSIGN_TASK_PERMISSION, {
              resource: TASK_DETAIL_PERMISSION_RESOURCE.task,
              identifier: task.id,
            })
            .subscribe((allowed: boolean) => {
              this.canAssignUserToTask$.next(allowed);
            });
        } else {
          this.logger.debug('Reset is user allowed to assign a user to Task as task is null');
          this.canAssignUserToTask$.next(false);
        }
      })
    );
  }

  private setFormDefinition(formDefinition: any): void {
    this._taskProcessLinkType$.next('form');
    this.formDefinition$.next(formDefinition);
  }

  private initializeFormWithSubmission(formDefinition: any): void {
    if (this.intermediateSaveEnabled) {
      // Wait for intermediate submission before rendering the form
      this.taskInstanceId$
        .pipe(
          filter(value => !!value),
          take(1),
          switchMap((taskInstanceId: string | null) =>
            this.taskIntermediateSaveService.getIntermediateSubmission(taskInstanceId ?? '')
          )
        )
        .subscribe({
          next: (intermediateSubmission: IntermediateSubmission) => {
            // Set submission first, then form definition, then mark as loaded
            this.submission$.next({
              data: intermediateSubmission?.submission || {},
            });
            this.setFormDefinition(formDefinition);
            this.loading$.next(false);
          },
          error: () => {
            // If fetching fails, still render form with empty submission
            this.submission$.next({data: {}});
            this.setFormDefinition(formDefinition);
            this.loading$.next(false);
          },
        });
    } else {
      // No intermediate save, render form immediately with empty submission
      this.submission$.next({data: {}});
      this.setFormDefinition(formDefinition);
      this.loading$.next(false);
    }
  }

  private setFormViewModelComponent(
    formDefinition: any,
    formName: string,
    taskInstanceId: string | null
  ): void {
    this.viewInitialized$.pipe(take(1)).subscribe(() => {
      this.formViewModelDynamicContainer.clear();
      if (!this.formViewModel) {
        return;
      }
      const formViewModelComponent = this.formViewModelDynamicContainer.createComponent(
        this.formViewModel.component
      );
      formViewModelComponent.instance.form = formDefinition;
      formViewModelComponent.instance.formName = formName;
      formViewModelComponent.instance.taskInstanceId = taskInstanceId;
      formViewModelComponent.instance.isStartForm = false;

      formViewModelComponent.instance.formSubmit
        .pipe(
          switchMap(() => this.task$),
          take(1)
        )
        .subscribe((task: Task | null) => {
          this.completeTask(task);
        });

      if (this.intermediateSaveEnabled) {
        this._subscriptions.add(
          formViewModelComponent.instance.submission$.subscribe(submission => {
            this.taskIntermediateSaveService.setSubmission(submission);
          })
        );
        this._subscriptions.add(
          this.submission$.pipe(distinctUntilChanged()).subscribe(submission => {
            if (submission?.data && Object.keys(submission.data).length === 0) {
              formViewModelComponent.instance.submission = {data: {}};
            }
          })
        );
        this.getCurrentProgress(formViewModelComponent);
      }

      this._subscriptions.add(
        this.closeModalEvent.subscribe(() => {
          formViewModelComponent.destroy();
        })
      );
    });
  }

  private setFormCustomComponent(
    formCustomComponentKey: string,
    taskInstanceId: string | null
  ): void {
    this.viewInitialized$.pipe(take(1)).subscribe(() => {
      this.formCustomComponentDynamicContainer.clear();
      if (!this.formCustomComponentConfig) {
        return;
      }
      let renderedComponent: ComponentRef<FormCustomComponent>;
      this._subscriptions.add(
        this._formCustomComponentConfig$.subscribe((formCustomComponentConfig: any) => {
          const customComponent = formCustomComponentConfig[formCustomComponentKey];
          renderedComponent = this.formCustomComponentDynamicContainer.createComponent(
            customComponent
          ) as ComponentRef<FormCustomComponent>;

          renderedComponent.instance.taskInstanceId = taskInstanceId;
          renderedComponent.instance.documentId = this.task$.getValue()?.businessKey ?? null;
          renderedComponent.instance.submittedEvent.subscribe(() => {
            this.completeTask(this.task$.getValue());
          });
        })
      );
      this._subscriptions.add(
        this.closeModalEvent.subscribe(() => {
          renderedComponent.destroy();
        })
      );
    });
  }

  private resetFormDefinition(): void {
    this.formDefinition$.next(null);
    this.submission$.next(null);
    this.loading$.next(true);
  }

  private resetTaskProcessLinkType(): void {
    this._taskProcessLinkType$.next(null);
    this._processLinkId$.next(null);
  }

  private setDocumentDefinitionNameInService(task: Task): void {
    this.documentService
      .getProcessDefinitionCaseDefinitionFromProcessInstanceId(task.processInstanceId)
      .subscribe(ProcessDefinitionCaseDefinition => {
        const caseDefinitionKey = ProcessDefinitionCaseDefinition.id.caseDefinitionId.key;
        this.modalService.setCaseDefinitionKey(caseDefinitionKey);
        this.stateService.setCaseDefinitionKey(caseDefinitionKey);
      });
  }
}
