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
  TASK_DETAIL_PERMISSION_RESOURCE,
  TaskDetailModalComponent,
  TaskModule,
} from '@valtimo/task';
import {ProcessService} from '@valtimo/process';
import {DocumentService} from '@valtimo/document';
import {ActivatedRoute} from '@angular/router';
import {PermissionService} from '@valtimo/access-control';
import {UserProviderService} from '@valtimo/security';
import moment from 'moment';
import {DossierDetailLayoutService} from '../../services';
import {ProcessLinkService, TaskWithProcessLink} from '@valtimo/process-link';

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

  @Input() public set openTaskAndProcessLinkInModal(value: TaskWithProcessLink) {
    if (value) this._taskDetailModal.openTaskAndProcessLinkDetails(value);
  }

  @Output() public readonly taskClickEvent = new EventEmitter<TaskWithProcessLink>();
  @Output() public readonly formSubmitEvent = new EventEmitter();

  public readonly loadingTasks$ = new BehaviorSubject<boolean>(true);

  private readonly _refresh$ = new BehaviorSubject<null>(null);

  private readonly _documentId$ = this.route.params.pipe(
    map(params => params?.documentId),
    filter(documentId => !!documentId)
  );

  public readonly processInstanceTasks$: Observable<{
    myTasks: TaskWithProcessLink[];
    otherTasks: TaskWithProcessLink[];
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
          this.processLinkService.getTasksWithProcessLinks(
            processDocumentInstance.id.processInstanceId
          )
        ),
      ])
    ),
    map(res => res.reduce((acc, curr) => [...acc, ...curr], [])),
    switchMap(tasksWithProcessLinks =>
      combineLatest([
        of(tasksWithProcessLinks),
        ...(tasksWithProcessLinks || []).map(taskWithProcessLink =>
          this.permissionService.requestPermission(CAN_VIEW_TASK_PERMISSION, {
            resource: TASK_DETAIL_PERMISSION_RESOURCE.task,
            identifier: taskWithProcessLink.task.id,
          })
        ),
      ])
    ),
    map(res => {
      const tasksWithProcessLinks = res[0] || [];
      const permissions = res?.filter((_, index) => index !== 0) as boolean[];
      const mappedTasksWithProcessLinks = this.mapTasksWithProcessLinks(
        tasksWithProcessLinks,
        permissions
      );
      const uniqueTasksWithProcessLinks = this.getUniqueTasksWithProcessLinks(
        mappedTasksWithProcessLinks
      );

      return this.getSortedTasksWithProcessLinks(uniqueTasksWithProcessLinks);
    }),
    map(tasksWithProcessLinks => this.sortTasksWithProcessLinksOnPermission(tasksWithProcessLinks)),
    tap(() => this.loadingTasks$.next(false))
  );

  public readonly formSize$ = this.dossierDetailLayoutService.formDisplaySize$;

  constructor(
    private readonly documentService: DocumentService,
    private readonly processService: ProcessService,
    private readonly route: ActivatedRoute,
    private readonly permissionService: PermissionService,
    private readonly userProviderService: UserProviderService,
    private readonly dossierDetailLayoutService: DossierDetailLayoutService,
    private readonly processLinkService: ProcessLinkService
  ) {}

  public rowTaskClick(tasWithProcessLinkk: TaskWithProcessLink): void {
    if (tasWithProcessLinkk.task.isLocked) return;

    this.taskClickEvent.emit(tasWithProcessLinkk);
  }

  public onFormSubmit(): void {
    this.formSubmitEvent.emit();
    this.refresh();
  }

  public refresh(): void {
    this._refresh$.next(null);
  }

  private mapTasksWithProcessLinks(
    tasksWithProcessLinks: TaskWithProcessLink[],
    permissions: boolean[]
  ): TaskWithProcessLink[] {
    return tasksWithProcessLinks.map((taskWithProcessLink, index) => ({
      ...taskWithProcessLink,
      task: {
        ...taskWithProcessLink.task,
        createdUnix: moment(taskWithProcessLink.task.created).unix(),
        created: moment(taskWithProcessLink.task.created).format('DD MMM YYYY HH:mm'),
        ...(taskWithProcessLink.task.due && {dueUnix: moment(taskWithProcessLink.task.due).unix()}),
        isLocked: !permissions[index],
      },
    }));
  }

  private getUniqueTasksWithProcessLinks(
    tasksWithProcessLinks: TaskWithProcessLink[]
  ): TaskWithProcessLink[] {
    return tasksWithProcessLinks.reduce((acc, curr) => {
      if (!acc.find(taskWithProcessLink => taskWithProcessLink.task.id === curr.task.id)) {
        return [...acc, curr];
      }
      return acc;
    }, [] as TaskWithProcessLink[]);
  }

  private getSortedTasksWithProcessLinks(
    tasksWithProcessLinks: TaskWithProcessLink[]
  ): TaskWithProcessLink[] {
    return tasksWithProcessLinks.sort((t1, t2) => {
      // high priority tasks on top
      if (t2.task.priority !== t1.task.priority) {
        return t2.task.priority - t1.task.priority;
      }

      // task with approaching due date on top
      const due1 = t1?.task.dueUnix || Number.MAX_VALUE;
      const due2 = t2?.task.dueUnix || Number.MAX_VALUE;
      if (due1 !== due2) {
        return due1 - due2;
      }

      // new task on top
      const createdCompare = t2.task.createdUnix / 5000 - t1.task.createdUnix / 5000;
      if (createdCompare !== 0) {
        return createdCompare;
      }

      // task with approximately the same age, are sorted by name
      return t1.task.name.localeCompare(t2.task.name);
    });
  }

  private sortTasksWithProcessLinksOnPermission(tasksWithProcessLinks: TaskWithProcessLink[]): {
    myTasks: TaskWithProcessLink[];
    otherTasks: TaskWithProcessLink[];
  } {
    return tasksWithProcessLinks.reduce(
      (acc, curr) =>
        !curr.task.isLocked
          ? {...acc, myTasks: [...acc.myTasks, curr]}
          : {...acc, otherTasks: [...acc.otherTasks, curr]},
      {myTasks: [] as TaskWithProcessLink[], otherTasks: [] as TaskWithProcessLink[]}
    );
  }
}
