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
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  inject,
  Input,
  Output,
  signal,
} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {RecentlyViewed16} from '@carbon/icons';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {PermissionService} from '@valtimo/access-control';
import {ConfirmationModalModule, TooltipModule} from '@valtimo/components';
import {ConfigService, GlobalNotificationService} from '@valtimo/shared';
import {TaskProcessLinkResult, TaskWithProcessLink} from '@valtimo/process-link';
import {ButtonModule, IconModule, IconService, ModalModule} from 'carbon-components-angular';
import moment from 'moment';
import {BehaviorSubject, combineLatest, Subject, switchMap, take, tap} from 'rxjs';
import {IntermediateSaveRequest, IntermediateSubmission, Task} from '../../models';
import {TaskIntermediateSaveService, TaskService} from '../../services';
import {
  CAN_COMPLETE_TASK_PERMISSION,
  TASK_DETAIL_PERMISSION_RESOURCE,
} from '../../task-permissions';

@Component({
  selector: 'valtimo-task-detail-intermediate-save',
  templateUrl: './task-detail-intermediate-save.component.html',
  styleUrls: ['./task-detail-intermediate-save.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ButtonModule,
    ConfirmationModalModule,
    IconModule,
    ModalModule,
    TooltipModule,
  ],
})
export class TaskDetailIntermediateSaveComponent {
  @Input() public set task(value: Task | null) {
    if (!value) {
      // A closed modal publishes no task, so its next open starts unanswered
      this.$canCompleteTask.set(null);
      return;
    }
    this.taskService
      .getTaskProcessLink(value.id)
      .pipe(take(1))
      .subscribe(res => {
        this.setFormFlow(res);
      });

    this.requestCompleteTaskPermission(value);
    this.taskValue.set(value);
    this.page.set({
      title: value.name,
      subtitle: `${this.translateService.instant('taskDetail.taskCreated')} ${value.created}`,
    });
    this.getCurrentProgress(value);
  }
  @Input() public set taskAndProcessLink(value: TaskWithProcessLink | null) {
    if (!value) return;

    this.setFormFlow(value.processLinkActivityResult);
    // Hosts only publish a task with its process link when they open it, so it starts unanswered
    this.$canCompleteTask.set(null);
    this.requestCompleteTaskPermission(value.task as any);
    this.taskValue.set(value.task as any);
    this.page.set({
      title: value?.task.name,
      subtitle: `${this.translateService.instant('taskDetail.taskCreated')} ${value?.task.created}`,
    });
    this.getCurrentProgress(value.task as any);
  }
  @Output() public readonly currentIntermediateSaveEvent =
    new EventEmitter<IntermediateSubmission | null>();
  @Output() public readonly showModalEvent = new EventEmitter();

  public readonly formFlowInstanceId$ = new BehaviorSubject<string | undefined>(undefined);
  public readonly showConfirmationModal$ = new BehaviorSubject<boolean>(false);

  public readonly taskValue = signal<Task | null>(null);
  public readonly page = signal<{title: string; subtitle: string} | null>(null);
  public readonly canAssignUserToTask = signal<boolean>(false);
  // null until the backend has answered; saving stays disabled until then
  public readonly $canCompleteTask = signal<boolean | null>(null);
  public readonly submission$ = this.taskIntermediateSaveService.submission$;
  public readonly formIoFormData$ = this.taskIntermediateSaveService.formIoFormData$;

  public readonly intermediateSaveEnabled$ =
    this.configService.getFeatureToggleObservable('enableIntermediateSave');
  public currentIntermediateSave: IntermediateSubmission | null = null;

  private readonly _completePermissionRequest$ = new Subject<string>();
  private readonly _permissionService = inject(PermissionService);

  constructor(
    private readonly configService: ConfigService,
    private readonly globalNotificationService: GlobalNotificationService,
    private readonly iconService: IconService,
    private readonly taskIntermediateSaveService: TaskIntermediateSaveService,
    private readonly taskService: TaskService,
    private readonly translateService: TranslateService
  ) {
    this.iconService.registerAll([RecentlyViewed16]);
    this.openCompletePermissionSubscription();
  }

  /** Re-requests the complete permission of the current task, e.g. after its permissions were invalidated. */
  public refreshCompleteTaskPermission(): void {
    const taskId = this.taskValue()?.id;
    if (taskId) this._completePermissionRequest$.next(taskId);
  }

  public saveCurrentProgress(): void {
    combineLatest([this.submission$, this.formIoFormData$])
      .pipe(
        take(1),
        switchMap(([submission, formIoFormData]) => {
          const dataToSave = submission?.data ? submission.data : formIoFormData;
          const intermediateSaveRequest: IntermediateSaveRequest = {
            submission: dataToSave,
            taskInstanceId: this.taskValue()?.id ?? '',
          };

          return this.taskIntermediateSaveService
            .storeIntermediateSubmission(intermediateSaveRequest)
            .pipe(
              tap(() => {
                // Update in-memory submission so form retains data on re-render
                this.taskIntermediateSaveService.setSubmission({data: dataToSave});
              })
            );
        })
      )
      .subscribe({
        next: intermediateSubmission => {
          this.globalNotificationService.showToast({
            title: this.translateService.instant('formManagement.intermediateSave.success'),
            type: 'success',
          });
          this.currentIntermediateSave = this.formatIntermediateSubmission(intermediateSubmission);
          this.currentIntermediateSaveEvent.emit(this.currentIntermediateSave);
        },
        error: () => {
          this.globalNotificationService.showToast({
            title: this.translateService.instant('formManagement.intermediateSave.error'),
            type: 'error',
          });
        },
      });
  }

  public revertSaveClick(): void {
    if (this.showModalEvent.observed) {
      this.showModalEvent.emit();
      return;
    }

    this.showConfirmationModal$.next(true);
  }

  public clearCurrentProgress(): void {
    this.taskIntermediateSaveService
      .clearIntermediateSubmission(this.taskValue()?.id ?? '')
      .pipe(take(1))
      .subscribe(() => {
        this.taskIntermediateSaveService.setSubmission({});
        this.currentIntermediateSave = null;
        this.currentIntermediateSaveEvent.emit(this.currentIntermediateSave);
      });
  }

  private openCompletePermissionSubscription(): void {
    this._completePermissionRequest$
      .pipe(
        switchMap(taskId =>
          this._permissionService.requestPermission(CAN_COMPLETE_TASK_PERMISSION, {
            resource: TASK_DETAIL_PERMISSION_RESOURCE.task,
            identifier: taskId,
          })
        ),
        takeUntilDestroyed()
      )
      .subscribe(allowed => this.$canCompleteTask.set(allowed));
  }

  private requestCompleteTaskPermission(task: Task): void {
    if (this.taskValue()?.id !== task.id) this.$canCompleteTask.set(null);
    this._completePermissionRequest$.next(task.id);
  }

  private setFormFlow(processLink: TaskProcessLinkResult): void {
    if (processLink !== null && processLink.type === 'form-flow') {
      this.formFlowInstanceId$.next(processLink.properties.formFlowInstanceId);
    }
  }

  private formatIntermediateSubmission(
    intermediateSubmission: IntermediateSubmission
  ): IntermediateSubmission {
    intermediateSubmission.createdOn = moment(intermediateSubmission.createdOn).format(
      'DD MMM YYYY HH:mm'
    );
    if (intermediateSubmission.editedOn) {
      intermediateSubmission.editedOn = moment(new Date(intermediateSubmission.editedOn)).format(
        'DD MMM YYYY HH:mm'
      );
    }

    return intermediateSubmission;
  }

  private getCurrentProgress(task: Task): void {
    this.taskIntermediateSaveService
      .getIntermediateSubmission(task.id ?? '')
      .pipe(take(1))
      .subscribe(intermediateSave => {
        if (intermediateSave !== null) {
          this.currentIntermediateSave = this.formatIntermediateSubmission(intermediateSave);
          // Update in-memory submission with data from API
          this.taskIntermediateSaveService.setSubmission({data: intermediateSave.submission});
        } else {
          this.currentIntermediateSave = null;
          this.taskIntermediateSaveService.setSubmission({});
        }

        this.currentIntermediateSaveEvent.emit(this.currentIntermediateSave);
      });
  }
}
