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

import {Component, EventEmitter, Input, Output, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {NgbTooltipModule} from '@ng-bootstrap/ng-bootstrap';
import {TranslateModule} from '@ngx-translate/core';
import {CarbonListModule, WidgetModule} from '@valtimo/components';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  map,
  Observable,
  of,
  repeat,
  switchMap,
  tap,
} from 'rxjs';
import {LayerModule, LoadingModule, TagModule, TilesModule} from 'carbon-components-angular';
import {
  CAN_VIEW_TASK_PERMISSION,
  Task,
  TASK_DETAIL_PERMISSION_RESOURCE,
  TaskDetailModalComponent,
  TaskModule,
} from '@valtimo/task';
import {ProcessInstanceTask, ProcessService} from '@valtimo/process';
import {UserIdentity} from '@valtimo/config';
import {DocumentService} from '@valtimo/document';
import {ActivatedRoute} from '@angular/router';
import {PermissionService} from '@valtimo/access-control';
import {UserProviderService} from '@valtimo/security';
import moment from 'moment';
import {DossierDetailLayoutService} from '../../services';

moment.locale(localStorage.getItem('langKey') || '');
moment.defaultFormat = 'DD MMM YYYY HH:mm';

@Component({
  selector: 'valtimo-dossier-detail-task-list',
  templateUrl: './dossier-detail-task-list.component.html',
  styleUrls: ['./dossier-detail-task-list.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    NgbTooltipModule,
    TranslateModule,
    WidgetModule,
    LoadingModule,
    TaskModule,
    TilesModule,
    LayerModule,
    TagModule,
    CarbonListModule,
  ],
})
export class DossierDetailTaskListComponent {
  @ViewChild('taskDetail') private readonly _taskDetailModal: TaskDetailModalComponent;

  @Input() public set openInTaskModal(value: Task) {
    if (value) this._taskDetailModal.openTaskDetails(value);
  }

  @Output() public readonly taskClickEvent = new EventEmitter<ProcessInstanceTask>();

  public readonly loadingTasks$ = new BehaviorSubject<boolean>(true);

  private readonly _refresh$ = new BehaviorSubject<null>(null);

  private readonly _documentId$ = this.route.params.pipe(
    map(params => params?.documentId),
    filter(documentId => !!documentId)
  );

  public readonly processInstanceTasks$: Observable<{
    myTasks: ProcessInstanceTask[];
    otherTasks: ProcessInstanceTask[];
  }> = this._refresh$.pipe(
    switchMap(() => this._documentId$),
    switchMap(documentId =>
      this.documentService
        .findProcessDocumentInstances(documentId)
        .pipe(repeat({count: 5, delay: 1500}))
    ),
    switchMap(processDocumentInstances =>
      combineLatest([
        ...processDocumentInstances.map(processDocumentInstance =>
          this.processService.getProcessInstanceTasks(processDocumentInstance.id.processInstanceId)
        ),
      ])
    ),
    map(res => res.reduce((acc, curr) => [...acc, ...curr], [])),
    switchMap(tasks =>
      combineLatest([
        of(tasks),
        ...(tasks || []).map(task =>
          this.permissionService.requestPermission(CAN_VIEW_TASK_PERMISSION, {
            resource: TASK_DETAIL_PERMISSION_RESOURCE.task,
            identifier: task.id,
          })
        ),
      ])
    ),
    map(res => {
      const tasks = res[0] || [];
      const permissions = res?.filter((_, index) => index !== 0) as boolean[];
      const mappedTasks = this.mapTasks(tasks, permissions);
      const uniqueTasks = this.getUniqueTasks(mappedTasks);

      return this.getSortedTasks(uniqueTasks);
    }),
    switchMap((tasks: ProcessInstanceTask[]) =>
      combineLatest([of(tasks), this.userProviderService.getUserSubject()])
    ),
    map(([tasks, userIdentity]) => this.sortTasksToUser(tasks, userIdentity)),
    tap(() => this.loadingTasks$.next(false))
  );

  public readonly formSize$ = this.dossierDetailLayoutService.formDisplaySize$;

  constructor(
    private readonly documentService: DocumentService,
    private readonly processService: ProcessService,
    private readonly route: ActivatedRoute,
    private readonly permissionService: PermissionService,
    private readonly userProviderService: UserProviderService,
    private readonly dossierDetailLayoutService: DossierDetailLayoutService
  ) {}

  public rowTaskClick(task: ProcessInstanceTask): void {
    if (task.isLocked) return;

    this.taskClickEvent.emit(task);
  }

  public refresh(): void {
    this._refresh$.next(null);
  }

  private mapTasks(tasks: ProcessInstanceTask[], permissions: boolean[]): ProcessInstanceTask[] {
    return tasks.map((task, index) => ({
      ...task,
      createdUnix: moment(task.created).unix(),
      created: moment(task.created).format('DD MMM YYYY HH:mm'),
      ...(task.due && {dueUnix: moment(task.due).unix()}),
      isLocked: !permissions[index],
    }));
  }

  private getUniqueTasks(tasks: ProcessInstanceTask[]): ProcessInstanceTask[] {
    return tasks.reduce((acc, curr) => {
      if (!acc.find(task => task.id === curr.id)) {
        return [...acc, curr];
      }
      return acc;
    }, [] as ProcessInstanceTask[]);
  }

  private getSortedTasks(tasks: ProcessInstanceTask[]): ProcessInstanceTask[] {
    return tasks.sort((t1, t2) => {
      // high priority tasks on top
      if (t2.priority !== t1.priority) {
        return t2.priority - t1.priority;
      }

      // task with approaching due date on top
      const due1 = t1?.dueUnix || Number.MAX_VALUE;
      const due2 = t2?.dueUnix || Number.MAX_VALUE;
      if (due1 !== due2) {
        return due1 - due2;
      }

      // new task on top
      const createdCompare = t2.createdUnix / 5000 - t1.createdUnix / 5000;
      if (createdCompare !== 0) {
        return createdCompare;
      }

      // task with approximately the same age, are sorted by name
      return t1.name.localeCompare(t2.name);
    });
  }

  private sortTasksToUser(
    tasks: ProcessInstanceTask[],
    user: UserIdentity
  ): {myTasks: ProcessInstanceTask[]; otherTasks: ProcessInstanceTask[]} {
    return tasks.reduce(
      (acc, curr) =>
        curr.assignee === user.username || curr.assignee === user.id
          ? {...acc, myTasks: [...acc.myTasks, curr]}
          : {...acc, otherTasks: [...acc.otherTasks, curr]},
      {myTasks: [] as ProcessInstanceTask[], otherTasks: [] as ProcessInstanceTask[]}
    );
  }
}
