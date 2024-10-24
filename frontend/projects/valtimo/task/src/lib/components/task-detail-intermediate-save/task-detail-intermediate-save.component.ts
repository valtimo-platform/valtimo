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
import {CommonModule} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import {RecentlyViewed16} from '@carbon/icons';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {ConfirmationModalModule, TooltipModule} from '@valtimo/components';
import {ConfigService} from '@valtimo/config';
import {ButtonModule, IconModule, IconService, ModalModule} from 'carbon-components-angular';
import moment from 'moment';
import {ToastrService} from 'ngx-toastr';
import {BehaviorSubject, combineLatest, switchMap, take} from 'rxjs';
import {IntermediateSaveRequest, IntermediateSubmission, Task} from '../../models';
import {TaskIntermediateSaveService, TaskService} from '../../services';

@Component({
  selector: 'valtimo-task-detail-intermediate-save',
  templateUrl: './task-detail-intermediate-save.component.html',
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
    if (!value) return;
    this.taskService
      .getTaskProcessLink(value.id)
      .pipe(take(1))
      .subscribe(res => {
        if (res !== null && res.type === 'form-flow')
          this.formFlowInstanceId$.next(res.properties.formFlowInstanceId);
      });

    this.taskValue.set(value);
    this.page.set({
      title: value.name,
      subtitle: `${this.translateService.instant('taskDetail.taskCreated')} ${value.created}`,
    });
    this.getCurrentProgress(value);
  }
  @Output() public readonly currentIntermediateSaveEvent =
    new EventEmitter<IntermediateSubmission | null>();
  @Output() public readonly showModalEvent = new EventEmitter();

  public readonly formFlowInstanceId$ = new BehaviorSubject<string | undefined>(undefined);
  public readonly showConfirmationModal$ = new BehaviorSubject<boolean>(false);

  public readonly taskValue = signal<Task | null>(null);
  public readonly page = signal<{title: string; subtitle: string} | null>(null);
  public readonly canAssignUserToTask = signal<boolean>(false);
  public readonly submission$ = this.taskIntermediateSaveService.submission$;
  public readonly formIoFormData$ = this.taskIntermediateSaveService.formIoFormData$;

  public intermediateSaveEnabled = false;
  public currentIntermediateSave: IntermediateSubmission | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly iconService: IconService,
    private readonly translateService: TranslateService,
    private readonly taskIntermediateSaveService: TaskIntermediateSaveService,
    private readonly taskService: TaskService,
    private readonly toastr: ToastrService
  ) {
    this.intermediateSaveEnabled = !!this.configService.featureToggles?.enableIntermediateSave;
    this.iconService.registerAll([RecentlyViewed16]);
  }

  public saveCurrentProgress(): void {
    combineLatest([this.submission$, this.formIoFormData$])
      .pipe(
        switchMap(([submission, formIoFormData]) => {
          const intermediateSaveRequest: IntermediateSaveRequest = {
            submission: submission?.data ? submission.data : formIoFormData,
            taskInstanceId: this.taskValue()?.id ?? '',
          };

          return this.taskIntermediateSaveService.storeIntermediateSubmission(
            intermediateSaveRequest
          );
        }),
        take(1)
      )
      .subscribe({
        next: intermediateSubmission => {
          this.toastr.success(
            this.translateService.instant('formManagement.intermediateSave.success')
          );
          this.currentIntermediateSave = this.formatIntermediateSubmission(intermediateSubmission);
          this.currentIntermediateSaveEvent.emit(this.currentIntermediateSave);
        },
        error: () => {
          this.toastr.error(this.translateService.instant('formManagement.intermediateSave.error'));
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
        this.currentIntermediateSave = this.formatIntermediateSubmission(intermediateSave);
      });
  }
}
