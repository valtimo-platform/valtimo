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
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import {Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {PermissionService} from '@valtimo/access-control';
import {Modal} from 'carbon-components-angular';
import moment from 'moment';
import {NGXLogger} from 'ngx-logger';
import {BehaviorSubject, Subscription} from 'rxjs';
import {IntermediateSubmission, Task} from '../../models';
import {CAN_ASSIGN_TASK_PERMISSION, TASK_DETAIL_PERMISSION_RESOURCE} from '../../task-permissions';
import {TaskDetailIntermediateSaveComponent} from '../task-detail-intermediate-save/task-detail-intermediate-save.component';
import {FormSize, formSizeToCarbonModalSizeMap} from '@valtimo/process-link';
import {CarbonModalSize} from '@valtimo/components';
import {TaskIntermediateSaveService} from '../../services';

moment.locale(localStorage.getItem('langKey') || '');

@Component({
  selector: 'valtimo-task-detail-modal',
  templateUrl: './task-detail-modal.component.html',
  styleUrls: ['./task-detail-modal.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class TaskDetailModalComponent implements OnInit {
  @ViewChild('taskDetailModal') private readonly _modal: Modal;
  @ViewChild(TaskDetailIntermediateSaveComponent)
  private readonly _intermediateSaveComponent: TaskDetailIntermediateSaveComponent;

  @Output() formSubmit = new EventEmitter();
  @Output() assignmentOfTaskChanged = new EventEmitter();

  @Input() set modalSize(value: FormSize) {
    if (value) this.size$.next(formSizeToCarbonModalSizeMap[value]);
  }

  public currentIntermediateSave$ = new BehaviorSubject<IntermediateSubmission | null>(null);

  public readonly task$ = new BehaviorSubject<Task | null>(null);
  public readonly submission$ = new BehaviorSubject<any>({});
  public readonly page$ = new BehaviorSubject<any>(null);
  public readonly formIoFormData$ = new BehaviorSubject<any>(null);
  public readonly showConfirmationModal$ = new BehaviorSubject<boolean>(false);

  public readonly size$ = new BehaviorSubject<CarbonModalSize>('md');

  public readonly canAssignUserToTask$ = new BehaviorSubject<boolean>(false);

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly router: Router,
    private readonly translateService: TranslateService,
    private readonly permissionService: PermissionService,
    private readonly logger: NGXLogger,
    private readonly taskIntermediateSaveService: TaskIntermediateSaveService
  ) {}

  public ngOnInit(): void {
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

  public clearCurrentProgress(): void {
    this._intermediateSaveComponent.clearCurrentProgress();
  }

  public openTaskDetails(task: Task | null): void {
    this.task$.next(task);
    this.page$.next({
      title: task?.name,
      subtitle: `${this.translateService.instant('taskDetail.taskCreated')} ${task?.created}`,
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
    this._modal.open = false;
    this.taskIntermediateSaveService.setSubmission({data: {}});
  }

  private openModal(): void {
    this._modal.open = true;
  }
}
