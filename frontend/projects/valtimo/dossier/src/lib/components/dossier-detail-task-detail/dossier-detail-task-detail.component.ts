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
  OnDestroy,
  Output,
  signal,
} from '@angular/core';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {PermissionService} from '@valtimo/access-control';
import {PageHeaderService} from '@valtimo/components';
import {ConfigService} from '@valtimo/config';
import {ProcessInstanceTask} from '@valtimo/process';
import {
  AssignUserToTaskComponent,
  CAN_ASSIGN_TASK_PERMISSION,
  IntermediateSubmission,
  TASK_DETAIL_PERMISSION_RESOURCE,
  TaskDetailContentComponent,
  TaskDetailIntermediateSaveComponent,
} from '@valtimo/task';
import {ButtonModule, IconModule} from 'carbon-components-angular';
import {BehaviorSubject, Observable, switchMap} from 'rxjs';

@Component({
  selector: 'valtimo-dossier-detail-task-detail',
  templateUrl: './dossier-detail-task-detail.component.html',
  styleUrl: './dossier-detail-task-detail.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    TaskDetailContentComponent,
    TaskDetailIntermediateSaveComponent,
    ButtonModule,
    IconModule,
    AssignUserToTaskComponent,
  ],
})
export class DossierDetailsTaskDetailComponent implements OnDestroy {
  @Input() public set task(value: ProcessInstanceTask | null) {
    if (!value) return;

    this.task$.next(value);
    this.pageValue.set({
      title: value?.name,
      subtitle: `${this.translateService.instant('taskDetail.taskCreated')} ${value?.created}`,
    });
  }
  @Output() public readonly closeEvent = new EventEmitter();
  @Output() public readonly assignmentOfTaskChanged = new EventEmitter();
  @Output() public readonly activeChange = new EventEmitter<boolean>();
  @Output() public readonly formSubmit = new EventEmitter();

  public readonly compactMode$: Observable<boolean> = this.pageHeaderService.compactMode$;
  public readonly task$ = new BehaviorSubject<ProcessInstanceTask | null>(null);
  public readonly canAssignUserToTask$: Observable<boolean> = this.task$.pipe(
    switchMap((task: ProcessInstanceTask | null) =>
      this.permissionService.requestPermission(CAN_ASSIGN_TASK_PERMISSION, {
        resource: TASK_DETAIL_PERMISSION_RESOURCE.task,
        identifier: task?.id ?? '',
      })
    )
  );
  public readonly intermediateSaveValue$ = new BehaviorSubject<IntermediateSubmission | null>(null);
  public readonly pageValue = signal<{title: string; subtitle: string}>({
    title: '',
    subtitle: '',
  });
  public enableIntermediateSave = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly pageHeaderService: PageHeaderService,
    private readonly permissionService: PermissionService,
    private readonly translateService: TranslateService
  ) {
    this.enableIntermediateSave = !!this.configService.featureToggles?.enableIntermediateSave;
  }

  public ngOnDestroy(): void {
    this.closeEvent.emit();
  }

  public onClose(): void {
    this.closeEvent.emit();
    this.onActiveChangeEvent(false);
  }

  public onCurrentIntermediateSaveEvent(value: IntermediateSubmission | null): void {
    this.intermediateSaveValue$.next(value);
    this.onActiveChangeEvent(false);
  }

  public onActiveChangeEvent(activeChange: boolean): void {
    this.activeChange.emit(activeChange);
  }

  public onFormSubmitEvent(): void {
    this.formSubmit.emit();
  }
}
