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
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import {Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {PermissionService} from '@valtimo/access-control';
import {CarbonModalSize, runAfterCarbonModalClosed} from '@valtimo/components';
import {SseService} from '@valtimo/sse';
import {FormSize, formSizeToCarbonModalSizeMap, TaskWithProcessLink} from '@valtimo/process-link';
import moment from 'moment';
import {NGXLogger} from 'ngx-logger';
import {BehaviorSubject, EMPTY, of, Subscription} from 'rxjs';
import {catchError, filter, switchMap, take} from 'rxjs/operators';
import {IntermediateSubmission, Task, TaskUpdateSseEvent} from '../../models';
import {TaskIntermediateSaveService, TaskService} from '../../services';
import {
  CAN_ASSIGN_TASK_PERMISSION,
  CAN_MODIFY_TASK_PERMISSION,
  TASK_DETAIL_PERMISSION_RESOURCE,
} from '../../task-permissions';
import {TaskDetailIntermediateSaveComponent} from '../task-detail-intermediate-save/task-detail-intermediate-save.component';
import {IconService} from 'carbon-components-angular';
import {DocumentService} from '@valtimo/document';
// @ts-ignore
import {FolderDetailsReference16} from '@carbon/icons';
import {GlobalNotificationService, TEST_IDS} from '@valtimo/shared';

moment.locale(localStorage.getItem('langKey') || '');

@Component({
  standalone: false,
  selector: 'valtimo-task-detail-modal',
  templateUrl: './task-detail-modal.component.html',
  styleUrls: ['./task-detail-modal.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class TaskDetailModalComponent implements OnInit, OnDestroy {
  readonly TEST_IDS = TEST_IDS;

  @ViewChild(TaskDetailIntermediateSaveComponent)
  private readonly _intermediateSaveComponent!: TaskDetailIntermediateSaveComponent;

  @Output() formSubmit = new EventEmitter();
  @Output() assignmentOfTaskChanged = new EventEmitter();

  @Input() set modalSize(value: FormSize) {
    if (value) this.size$.next(formSizeToCarbonModalSizeMap[value]);
  }

  @Input() set openFromCaseManagement(value: boolean) {
    if (value) this.openFromCaseManagement$.next(value);
  }

  public currentIntermediateSave$ = new BehaviorSubject<IntermediateSubmission | null>(null);

  public readonly processLinkPreloaded$ = new BehaviorSubject<boolean>(false);
  public readonly task$ = new BehaviorSubject<Task | null>(null);
  public readonly taskAndProcessLink$ = new BehaviorSubject<TaskWithProcessLink | null>(null);
  public readonly task = new BehaviorSubject<Task | null>(null);
  public readonly submission$ = new BehaviorSubject<any>({});
  public readonly page$ = new BehaviorSubject<any>(null);
  public readonly showConfirmationModal$ = new BehaviorSubject<boolean>(false);
  public readonly businessKey$ = new BehaviorSubject<string>('');

  public readonly size$ = new BehaviorSubject<CarbonModalSize>('md');
  public readonly openFromCaseManagement$ = new BehaviorSubject<boolean>(false);

  public readonly canAssignUserToTask$ = new BehaviorSubject<boolean>(false);
  public readonly canModifyTask$ = new BehaviorSubject<boolean>(false);

  public readonly modalCloseEvent$ = new BehaviorSubject<boolean>(false);

  public readonly modalOpen$ = new BehaviorSubject<boolean>(false);

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly router: Router,
    private readonly translateService: TranslateService,
    private readonly permissionService: PermissionService,
    private readonly logger: NGXLogger,
    private readonly taskIntermediateSaveService: TaskIntermediateSaveService,
    private readonly sseService: SseService,
    private readonly cdr: ChangeDetectorRef,
    private readonly iconService: IconService,
    private readonly documentService: DocumentService,
    private readonly taskService: TaskService,
    private readonly globalNotificationService: GlobalNotificationService
  ) {
    this.iconService.registerAll([FolderDetailsReference16]);
  }

  public ngOnInit(): void {
    this.openTaskSubscription();
    this.openTaskUpdateSseEventSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public openRelatedCase(): void {
    const businessKey = this.businessKey$.getValue();

    this.documentService
      .getDocument(businessKey)
      .pipe(take(1))
      .subscribe(document => {
        window.open(`/cases/${document.definitionId?.name}/document/${businessKey}`, '_blank');
      });
  }

  private openTaskSubscription(): void {
    this._subscriptions.add(
      this.task$.subscribe(task => {
        if (task) {
          this.logger.debug('Checking if user allowed to assign a user to Task with id:', task.id);
          this.businessKey$.next(task.businessKey);

          this.permissionService
            .requestPermission(CAN_ASSIGN_TASK_PERMISSION, {
              resource: TASK_DETAIL_PERMISSION_RESOURCE.task,
              identifier: task.id,
            })
            .subscribe((allowed: boolean) => {
              this.canAssignUserToTask$.next(allowed);
            });

          this.permissionService
            .requestPermission(CAN_MODIFY_TASK_PERMISSION, {
              resource: TASK_DETAIL_PERMISSION_RESOURCE.task,
              identifier: task.id,
            })
            .subscribe((allowed: boolean) => {
              this.canModifyTask$.next(allowed);
            });
        } else {
          this.logger.debug('Reset is user allowed to assign a user to Task as task is null');
          this.canAssignUserToTask$.next(false);
        }
      })
    );
  }

  private openTaskUpdateSseEventSubscription(): void {
    this._subscriptions.add(
      this.sseService
        .getSseEventObservable<TaskUpdateSseEvent>('TASK_UPDATE')
        .pipe(
          filter(event => this.task$.getValue()?.id === event.taskId),
          switchMap(event =>
            this.taskService.getTask(event.taskId).pipe(
              catchError(err => {
                if (err.status === 404) {
                  return of(null);
                }
                this.logger.error('Failed to fetch task on SSE update', err);
                return EMPTY;
              })
            )
          )
        )
        .subscribe(response => {
          if (!response) {
            this.closeModal();
          } else {
            const currentTask = this.task$.getValue();
            const newTask = response.task;

            if (currentTask && newTask && currentTask.assignee !== newTask.assignee) {
              if (newTask.assignee) {
                const assigneeName =
                  newTask.valtimoAssignee?.fullName ||
                  newTask.assignee ||
                  this.translateService.instant('taskDetail.unknownAssignee');
                this.globalNotificationService.showToast({
                  title: this.translateService.instant('taskDetail.assignedNotificationTitle'),
                  content: `${this.translateService.instant(
                    'taskDetail.assignedNotificationContent'
                  )} ${assigneeName}`,
                  type: 'info',
                });
              } else {
                this.globalNotificationService.showToast({
                  title: this.translateService.instant('taskDetail.unassignedNotificationTitle'),
                  content: this.translateService.instant(
                    'taskDetail.unassignedNotificationContent'
                  ),
                  type: 'info',
                });
              }
            }

            this.task$.next(newTask);
          }
        })
    );
  }

  public clearCurrentProgress(): void {
    this._intermediateSaveComponent.clearCurrentProgress();
  }

  public openTaskDetails(task: Task | null): void {
    if (task) {
      this.task$.next({...task});
    }
    this.page$.next({
      title: task?.name,
      subtitle: `${this.translateService.instant('taskDetail.taskCreated')} ${task?.created}`,
    });

    this.openModal();
  }

  public openTaskAndProcessLinkDetails(taskWithProcessLink: TaskWithProcessLink | null): void {
    this.processLinkPreloaded$.next(true);
    if (taskWithProcessLink) {
      this.taskAndProcessLink$.next(taskWithProcessLink);
      this.task$.next({...taskWithProcessLink.task} as unknown as Task);
    }
    this.page$.next({
      title: taskWithProcessLink?.task?.name,
      subtitle: `${this.translateService.instant('taskDetail.taskCreated')} ${taskWithProcessLink?.task?.created}`,
    });

    this.openModal();
  }

  public gotoProcessLinkScreen(): void {
    this.closeModal();
    this.router.navigate(['process-links']);
  }

  public onCurrentIntermediateSaveEvent(value: IntermediateSubmission | null): void {
    this.currentIntermediateSave$.next(value);
  }

  public onFormSubmit(): void {
    this.formSubmit.emit();
  }

  public onShowModalEvent(): void {
    this.showConfirmationModal$.next(true);
  }

  public closeModal(): void {
    this.modalOpen$.next(false);
    this.modalCloseEvent$.next(!this.modalCloseEvent$.getValue());
    // Delay clearing submission until after modal close animation completes
    runAfterCarbonModalClosed(() => {
      this.taskIntermediateSaveService.setSubmission({});
    });
  }

  private openModal(): void {
    this.modalOpen$.next(false);

    setTimeout(() => {
      this.modalOpen$.next(true);
      this.cdr.detectChanges();
    });
  }
}
