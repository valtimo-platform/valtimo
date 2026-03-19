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
  Input,
  OnDestroy,
  Output,
  signal,
} from '@angular/core';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {PermissionService} from '@valtimo/access-control';
import {AssignmentChangeEvent, AssignmentComponent, PageHeaderService} from '@valtimo/components';
import {ConfigService, NamedUser, TeamResponseDto} from '@valtimo/shared';
import {ProcessInstanceTask} from '@valtimo/process';
import {
  CAN_ASSIGN_TASK_PERMISSION,
  CAN_MODIFY_TASK_PERMISSION,
  IntermediateSubmission,
  SetTaskDueDateComponent,
  TASK_DETAIL_PERMISSION_RESOURCE,
  TaskDetailContentComponent,
  TaskDetailIntermediateSaveComponent,
  TaskService,
} from '@valtimo/task';
import {ButtonModule, IconModule} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, filter, map, Observable, of, shareReplay, switchMap, take} from 'rxjs';
import {TaskWithProcessLink} from '@valtimo/process-link';

@Component({
  selector: 'valtimo-case-detail-task-detail',
  templateUrl: './case-detail-task-detail.component.html',
  styleUrl: './case-detail-task-detail.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    TaskDetailContentComponent,
    TaskDetailIntermediateSaveComponent,
    ButtonModule,
    IconModule,
    AssignmentComponent,
    SetTaskDueDateComponent,
  ],
})
export class CaseDetailsTaskDetailComponent implements OnDestroy {
  @Input() public set taskAndProcessLink(value: TaskWithProcessLink | null) {
    if (!value) return;

    this.taskAndProcessLink$.next(value);
    this.task$.next(value.task);
    this.pageValue.set({
      title: value?.task.name,
      subtitle: `${this.translateService.instant('taskDetail.taskCreated')} ${value?.task?.created}`,
    });
  }
  @Output() public readonly closeEvent = new EventEmitter();
  @Output() public readonly assignmentOfTaskChanged = new EventEmitter();
  @Output() public readonly dueDateChanged = new EventEmitter();
  @Output() public readonly activeChange = new EventEmitter<boolean>();
  @Output() public readonly formSubmit = new EventEmitter();

  public readonly compactMode$: Observable<boolean> = this.pageHeaderService.compactMode$;
  public readonly taskAndProcessLink$ = new BehaviorSubject<TaskWithProcessLink | null>(null);
  public readonly task$ = new BehaviorSubject<ProcessInstanceTask | null>(null);
  public readonly canAssignUserToTask$: Observable<boolean> = this.task$.pipe(
    switchMap((task: ProcessInstanceTask | null) =>
      this.permissionService.requestPermission(CAN_ASSIGN_TASK_PERMISSION, {
        resource: TASK_DETAIL_PERMISSION_RESOURCE.task,
        identifier: task?.id ?? '',
      })
    )
  );
  public readonly canModifyTask$: Observable<boolean> = this.task$.pipe(
    switchMap((task: ProcessInstanceTask | null) =>
      this.permissionService.requestPermission(CAN_MODIFY_TASK_PERMISSION, {
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
  public readonly candidateUsers$: Observable<NamedUser[]> = combineLatest([
    this.task$.pipe(filter(task => !!task)),
    this.canAssignUserToTask$,
  ]).pipe(
    switchMap(([task, canAssign]) => (canAssign ? this.taskService.getCandidateUsers(task.id) : of([]))),
    shareReplay(1)
  );

  public readonly candidateTeams$: Observable<TeamResponseDto[]> = combineLatest([
    this.task$.pipe(filter(task => !!task)),
    this.canAssignUserToTask$,
  ]).pipe(
    switchMap(([task, canAssign]) =>
      canAssign ? this.taskService.getCandidateTeams(task.id).pipe(map(page => page.content)) : of([])
    ),
    shareReplay(1)
  );

  public enableIntermediateSave = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly pageHeaderService: PageHeaderService,
    private readonly permissionService: PermissionService,
    private readonly translateService: TranslateService,
    private readonly taskService: TaskService
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

  public onAssignmentChanged(event: AssignmentChangeEvent): void {
    this.task$.pipe(take(1)).subscribe(task => {
      if (!task) return;

      const assignRequest: {assignee?: string; assignedTeamKey?: string} = {};
      if (event.userId !== undefined) assignRequest.assignee = event.userId ?? '';
      if (event.teamKey !== undefined) assignRequest.assignedTeamKey = event.teamKey ?? '';

      this.taskService
        .assignTask(task.id, assignRequest)
        .pipe(
          switchMap(() => this.taskService.getTask(task.id)),
          take(1)
        )
        .subscribe(response => {
          this.refreshTask(response);
          this.assignmentOfTaskChanged.emit();
        });
    });
  }

  public onUnassigned(): void {
    this.task$.pipe(take(1)).subscribe(task => {
      if (!task) return;
      this.taskService
        .unassignTask(task.id)
        .pipe(
          switchMap(() => this.taskService.getTask(task.id)),
          take(1)
        )
        .subscribe(response => {
          this.refreshTask(response);
          this.assignmentOfTaskChanged.emit();
        });
    });
  }

  private refreshTask(response: any): void {
    const currentTask = this.task$.getValue();
    if (!currentTask) return;

    const fetchedTask = response.task as Partial<ProcessInstanceTask>;
    if (!fetchedTask) return;

    const mergedTask: ProcessInstanceTask = {...currentTask};
    for (const [key, value] of Object.entries(fetchedTask)) {
      if (value !== undefined) {
        (mergedTask as any)[key] = value;
      }
    }
    this.task$.next(mergedTask);
  }

  public onDueDateChanged(): void {
    this.dueDateChanged.emit();
  }

  public onFormSubmitEvent(): void {
    this.formSubmit.emit();
  }
}
