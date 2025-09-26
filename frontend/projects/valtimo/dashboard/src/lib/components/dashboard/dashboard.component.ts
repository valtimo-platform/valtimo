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
import {Component, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Task, TaskDetailModalComponent, TaskService} from '@valtimo/task';
import moment from 'moment';
import {BehaviorSubject} from 'rxjs';
import {take} from 'rxjs/operators';

moment.locale(localStorage.getItem('langKey') || '');
moment.defaultFormat = 'DD MMM YYYY HH:mm';

@Component({
  selector: 'valtimo-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
  public processDefinitions: Array<any>;
  public openTasks: Array<any>;
  public openTaskFields = [
    {
      key: 'created',
      label: 'Created',
    },
    {
      key: 'name',
      label: 'Name',
    },
    {
      key: 'valtimoAssignee.fullName',
      label: 'Assignee',
    },
  ];
  @ViewChild('taskDetail') taskDetail: TaskDetailModalComponent;

  loading$ = new BehaviorSubject<boolean>(true);

  constructor(
    private readonly taskService: TaskService,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.getOpenTasks();
  }

  public getOpenTasks() {
    this.taskService.getTasks().subscribe(response => {
      this.openTasks = response;
      this.openTasks.map(task => {
        task.created = moment(task.created).format('DD MMM YYYY HH:mm');
      });
      this.checkRouteForTaskId(response);
      this.loading$.next(false);
    });
  }

  public rowOpenTaskClick(task) {
    if (!task.endTime) {
      this.taskDetail.openTaskDetails(task);
    }
  }

  private checkRouteForTaskId(tasks: Array<Task>): void {
    this.route.queryParams.pipe(take(1)).subscribe(params => {
      const taskId = params?.taskId;
      const findTaskFromId = tasks.find(task => task.id === taskId);

      if (findTaskFromId) {
        this.rowOpenTaskClick(findTaskFromId);
      }
    });
  }
}
