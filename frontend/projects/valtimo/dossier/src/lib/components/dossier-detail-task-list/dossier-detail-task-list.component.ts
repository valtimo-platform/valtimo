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

import {Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {NgbTooltipModule} from '@ng-bootstrap/ng-bootstrap';
import {TranslateModule} from '@ngx-translate/core';
import {CarbonListModule, WidgetModule} from '@valtimo/components';
import {BehaviorSubject, combineLatest, of, repeat, Subscription, switchMap} from 'rxjs';
import {LayerModule, LoadingModule, TagModule, TilesModule} from 'carbon-components-angular';
import {ProcessInstanceTask, ProcessService} from '@valtimo/process';
import moment from 'moment/moment';
import {
  CAN_VIEW_TASK_PERMISSION,
  Task,
  TASK_DETAIL_PERMISSION_RESOURCE,
  TaskDetailModalComponent,
  TaskModule,
} from '@valtimo/task';
import {ActivatedRoute, ParamMap} from '@angular/router';
import {Document, DocumentService, ProcessDocumentInstance} from '@valtimo/document';
import {UserProviderService} from '@valtimo/security';
import {PermissionService} from '@valtimo/access-control';

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
export class DossierDetailTaskListComponent implements OnInit, OnDestroy {
  @ViewChild('taskDetail') taskDetail: TaskDetailModalComponent;

  public tasks: ProcessInstanceTask[] = [];
  public processDocumentInstances: ProcessDocumentInstance[] = [];
  public roles: string[] = [];
  public documentId!: string;
  public document!: Document;
  public moment!: typeof moment;

  public readonly loadingTasks$ = new BehaviorSubject<boolean>(true);

  public readonly documentDefinitionName: string;

  private _subscriptions = new Subscription();

  private snapshot!: ParamMap;

  constructor(
    private readonly documentService: DocumentService,
    private readonly processService: ProcessService,
    private readonly route: ActivatedRoute,
    private readonly userProviderService: UserProviderService,
    private readonly permissionService: PermissionService
  ) {
    this.snapshot = this.route.snapshot.paramMap;
    this.documentDefinitionName = this.snapshot.get('documentDefinitionName') || '';
    this.documentId = this.snapshot.get('documentId') || '';
  }

  public ngOnInit(): void {
    this.moment = moment;
    this.init();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public init(): void {
    this._subscriptions.add(
      this.documentService.getDocument(this.documentId).subscribe(document => {
        this.document = document;
      })
    );

    this._subscriptions.add(
      this.userProviderService.getUserSubject().subscribe(user => {
        this.roles = user.roles;
        this.tasks = [];
        this.loadProcessDocumentInstances(this.documentId);
      })
    );
  }

  public rowTaskClick(task: Task): void {
    if (task.locked) return;

    this.taskDetail.openTaskDetails(task);
  }

  public loadProcessDocumentInstances(documentId: string): void {
    this._subscriptions.add(
      this.documentService
        .findProcessDocumentInstances(documentId)
        .pipe(repeat({count: 5, delay: 1500}))
        .subscribe(processDocumentInstances => {
          this.processDocumentInstances = processDocumentInstances;
          this.processDocumentInstances.forEach(instance => {
            this.loadProcessInstanceTasks(instance.id.processInstanceId);
          });
        })
    );
  }

  private loadProcessInstanceTasks(processInstanceId: string): void {
    this._subscriptions.add(
      this.processService
        .getProcessInstanceTasks(processInstanceId)
        .pipe(
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
          )
        )
        .subscribe(res => {
          const tasks = res?.[0];
          const permissions = res?.filter((_, index) => index !== 0);

          if (!!tasks) {
            tasks.forEach((task, taskIndex) => {
              task.createdUnix = this.moment(task.created).unix();
              task.created = this.moment(task.created).format('DD MMM YYYY HH:mm');
              if (!!task.due) {
                task.dueUnix = this.moment(task.due).unix();
              }
              task.isLocked = !permissions[taskIndex];
            });
            const newTasks = tasks.filter(
              newTask => !this.tasks.some(existingTask => existingTask.id === newTask.id)
            );
            this.tasks = this.tasks.concat(newTasks);
            this.tasks.sort((t1, t2) => {
              // high priority tasks on top
              if (t2.priority != t1.priority) {
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

          this.loadingTasks$.next(false);
        })
    );
  }
}
