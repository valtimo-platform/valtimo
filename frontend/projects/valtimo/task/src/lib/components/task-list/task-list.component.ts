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

import {ChangeDetectionStrategy, Component, ViewChild, ViewEncapsulation} from '@angular/core';
import {Router} from '@angular/router';
import {TaskService} from '../../services/task.service';
import moment from 'moment';
import {Task, TaskPageParams} from '../../models';
import {TaskDetailModalComponent} from '../task-detail-modal/task-detail-modal.component';
import {BehaviorSubject, combineLatest, Observable, of, switchMap, tap} from 'rxjs';
import {ConfigService, SortState, TaskListTab} from '@valtimo/config';
import {DocumentService} from '@valtimo/document';
import {distinctUntilChanged, map, take} from 'rxjs/operators';
import {PermissionService} from '@valtimo/access-control';
import {
  CAN_VIEW_CASE_PERMISSION,
  CAN_VIEW_TASK_PERMISSION,
  TASK_DETAIL_PERMISSION_RESOURCE,
} from '../../task-permissions';
import {TaskListService} from '../../services';
import {isEqual} from 'lodash';
import {ColumnConfig, ViewType} from '@valtimo/components';
import {ListItem} from 'carbon-components-angular';
import {TranslateService} from '@ngx-translate/core';

moment.locale(localStorage.getItem('langKey') || '');

@Component({
  selector: 'valtimo-task-list',
  templateUrl: './task-list.component.html',
  styleUrls: ['./task-list.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [TaskListService],
})
export class TaskListComponent {
  @ViewChild('taskDetail') private readonly _taskDetail: TaskDetailModalComponent;

  private readonly _DEFAULT_TASK_LIST_FIELDS: ColumnConfig[] = [
    {
      key: 'created',
      label: `task-list.fieldLabels.created`,
      viewType: ViewType.TEXT,
      sortable: true,
    },
    {
      key: 'name',
      label: `task-list.fieldLabels.name`,
      viewType: ViewType.TEXT,
      sortable: true,
    },
    {
      key: 'valtimoAssignee.fullName',
      label: `task-list.fieldLabels.valtimoAssignee.fullName`,
      viewType: ViewType.TEXT,
    },
    {
      key: 'due',
      label: `task-list.fieldLabels.due`,
      viewType: ViewType.TEXT,
      sortable: true,
    },
    {
      key: 'context',
      label: `task-list.fieldLabels.context`,
      viewType: ViewType.TEXT,
    },
  ];

  public readonly fields$ = new BehaviorSubject<ColumnConfig[]>(this._DEFAULT_TASK_LIST_FIELDS);
  public readonly loadingTasks$ = new BehaviorSubject<boolean>(true);
  public readonly visibleTabs$ = new BehaviorSubject<Array<TaskListTab> | null>(null);

  private readonly _selectedTaskType$ = new BehaviorSubject<TaskListTab>(TaskListTab.MINE);
  public readonly selectedTaskType$ = this._selectedTaskType$.pipe(
    tap(type => {
      if (this.taskService.getConfigCustomTaskList()) {
        this.customTaskListFields();
      } else {
        this.defaultTaskListFields();
      }
    })
  );
  private get _selectedTaskType(): TaskListTab {
    return this._selectedTaskType$.getValue();
  }

  private readonly _pagination$ = new BehaviorSubject<{[key in TaskListTab]: TaskPageParams}>({
    [TaskListTab.ALL]: this.getDefaultPagination(),
    [TaskListTab.MINE]: this.getDefaultPagination(),
    [TaskListTab.OPEN]: this.getDefaultPagination(),
  });
  private readonly _paginationForCurrentTaskType$ = combineLatest([
    this._selectedTaskType$,
    this._pagination$,
  ]).pipe(map(([selectedTaskType, pagination]) => pagination[selectedTaskType]));
  public get paginationForCurrentTaskType$(): Observable<TaskPageParams> {
    return this._paginationForCurrentTaskType$.pipe(
      map(pagination => ({...pagination, page: pagination.page + 1}))
    );
  }
  private readonly _sortState$ = new BehaviorSubject<{[key in TaskListTab]: SortState | null}>({
    [TaskListTab.ALL]: this._defaultSortState,
    [TaskListTab.MINE]: this._defaultSortState,
    [TaskListTab.OPEN]: this._defaultSortState,
  });

  private _enableLoadingAnimation$ = new BehaviorSubject<boolean>(true);

  public readonly cachedTasks$ = new BehaviorSubject<Task[] | null>(null);

  private readonly _ALL_CASES_ID = 'ALL_CASES';

  public readonly tasks$: Observable<Task[]> = combineLatest([
    this.selectedTaskType$,
    this._pagination$,
    this._sortState$,
    this.taskListService.caseDefinitionName$,
    this._enableLoadingAnimation$,
  ]).pipe(
    map(([selectedTaskType, pagination, sortState, caseDefinitionName, enableLoadingAnimation]) => {
      const sortParams = sortState[selectedTaskType];
      const params = {
        ...pagination[selectedTaskType],
        ...(sortParams && {sort: this.getSortString(sortParams)}),
      };

      delete params.collectionSize;

      return {
        params: {
          selectedTaskType,
          params,
          ...(caseDefinitionName &&
            caseDefinitionName !== this._ALL_CASES_ID && {caseDefinitionName}),
        },
        enableLoadingAnimation,
      };
    }),
    distinctUntilChanged((previous, current) => isEqual(previous.params, current.params)),
    tap(({enableLoadingAnimation}) => {
      if (enableLoadingAnimation) this.loadingTasks$.next(true);
    }),
    switchMap(({params}) =>
      this.taskService.queryTasksPageV3(
        params.selectedTaskType,
        params.params,
        params.caseDefinitionName
      )
    ),
    switchMap(tasksResult => {
      const taskResults = tasksResult.content;
      const hasTaskResults = Array.isArray(taskResults) && taskResults.length > 0;

      return combineLatest([
        of(tasksResult),
        hasTaskResults
          ? combineLatest(
              taskResults.map(task =>
                this.permissionService.requestPermission(CAN_VIEW_TASK_PERMISSION, {
                  resource: TASK_DETAIL_PERMISSION_RESOURCE.task,
                  identifier: task.id,
                })
              )
            )
          : of(null),
        hasTaskResults
          ? combineLatest(
              taskResults.map(task =>
                this.permissionService.requestPermission(CAN_VIEW_CASE_PERMISSION, {
                  resource: TASK_DETAIL_PERMISSION_RESOURCE.jsonSchemaDocument,
                  identifier: task.businessKey,
                })
              )
            )
          : of(null),
      ]);
    }),
    map(([taskResult, canViewTaskPermissions, canViewCasePermissions]) => {
      this.updateTaskPagination(this._selectedTaskType, {
        collectionSize: Number(taskResult.totalElements),
      });

      return taskResult?.content?.map((task, taskIndex) => {
        const createdDate = moment(task.created);
        const dueDate = moment(task.due);
        const taskCopy = {...task};

        if (task.due && dueDate.isValid()) taskCopy.due = dueDate.format('DD MMM YYYY HH:mm');
        if (createdDate.isValid()) taskCopy.created = createdDate.format('DD MMM YYYY HH:mm');
        if (canViewTaskPermissions) taskCopy.locked = !canViewTaskPermissions[taskIndex];
        if (canViewCasePermissions) taskCopy.caseLocked = !canViewCasePermissions[taskIndex];

        return taskCopy;
      });
    }),
    tap(tasks => {
      this.cachedTasks$.next(tasks);
      this.loadingTasks$.next(false);
      this.disableLoadingAnimation();
    })
  );

  public readonly loadingCaseListItems$ = new BehaviorSubject<boolean>(true);
  private readonly _selectedCaseDefinitionId$ = new BehaviorSubject<string>(this._ALL_CASES_ID);
  public readonly caseListItems$: Observable<ListItem[]> = combineLatest([
    this.documentService.getAllDefinitions(),
    this._selectedCaseDefinitionId$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([documentDefinitionRes, selectedCaseDefinitionId]) => [
      {
        content: this.translateService.instant('task-list.allCases'),
        id: this._ALL_CASES_ID,
        selected: selectedCaseDefinitionId === this._ALL_CASES_ID,
      },
      ...documentDefinitionRes.content.map(documentDefinition => ({
        id: documentDefinition.id.name,
        content: documentDefinition?.schema?.title,
        selected: documentDefinition.id.name === selectedCaseDefinitionId,
      })),
    ]),
    tap(() => this.loadingCaseListItems$.next(false))
  );

  constructor(
    private readonly configService: ConfigService,
    private readonly documentService: DocumentService,
    private readonly permissionService: PermissionService,
    private readonly router: Router,
    private readonly taskService: TaskService,
    private readonly taskListService: TaskListService,
    private readonly translateService: TranslateService
  ) {
    this.setVisibleTabs();
  }

  public paginationClicked(page: number, type: TaskListTab | string): void {
    this.updateTaskPagination(type as TaskListTab, {page: page - 1});
  }

  public paginationSet(newSize: number): void {
    combineLatest([this._paginationForCurrentTaskType$, this._selectedTaskType$])
      .pipe(take(1))
      .subscribe(([pagination, selectedTaskType]) => {
        this.updateTaskPagination(selectedTaskType, {
          size: Number(newSize),
          page: this.getLastAvailablePage(
            pagination.page,
            Number(newSize),
            pagination.collectionSize
          ),
        });
      });
  }

  public tabChange(tab: TaskListTab | string): void {
    this._selectedTaskType$.pipe(take(1)).subscribe(selectedTaskType => {
      if (selectedTaskType !== tab) {
        this.enableLoadingAnimation();
        this._selectedTaskType$.next(tab as TaskListTab);
        this.updateTaskPagination(tab as TaskListTab, {page: 0});
      }
    });
  }

  public showTask(task: Task): void {
    this.router.navigate(['tasks', task.id]);
  }

  public openRelatedCase(event: MouseEvent, index: number): void {
    event.stopPropagation();

    this.cachedTasks$.pipe(take(1)).subscribe(cachedTasks => {
      const currentTask = cachedTasks && cachedTasks[index];

      if (currentTask && !currentTask.caseLocked) {
        this.documentService
          .getDocument(currentTask.businessKey)
          .pipe(take(1))
          .subscribe(document => {
            this.router.navigate([
              `/dossiers/${document.definitionId?.name}/document/${currentTask.businessKey}`,
            ]);
          });
      }
    });
  }

  public defaultTaskListFields(): void {
    this.fields$.next(this._DEFAULT_TASK_LIST_FIELDS);
  }

  public customTaskListFields(): void {
    const customTaskListFields = this.taskService.getConfigCustomTaskList().fields;

    if (customTaskListFields) {
      this.fields$.next(
        customTaskListFields.map((column, index) => ({
          key: column.propertyName,
          label: `task-list.fieldLabels.${column.translationKey}`,
          sortable: column.sortable,
          ...(column.viewType && {viewType: column.viewType}),
          ...(column.enum && {enum: column.enum}),
        }))
      );
    }
  }

  public rowOpenTaskClick(task): void | boolean {
    return !task.endTime && !task.locked ? this._taskDetail.openTaskDetails(task) : false;
  }

  public sortChanged(sortState: SortState): void {
    this._selectedTaskType$.pipe(take(1)).subscribe(selectedTaskType => {
      this.updateSortState(selectedTaskType, sortState);
    });
  }

  public setCaseDefinition(definition: {item: {id: string}}): void {
    if (definition.item.id) this.taskListService.setCaseDefinitionName(definition.item.id);
  }

  private getSortString(sort: SortState): string {
    return `${sort.state.name},${sort.state.direction}`;
  }

  private get _defaultSortState(): SortState | null {
    return this.taskService.getConfigCustomTaskList()?.defaultSortedColumn || null;
  }

  private getDefaultPagination(): TaskPageParams {
    return {
      page: 0,
      size: 10,
    };
  }

  private setVisibleTabs(): void {
    const visibleTabs = this.configService.config?.visibleTaskListTabs || null;
    this.visibleTabs$.next(visibleTabs);
    if (visibleTabs) this._selectedTaskType$.next(visibleTabs[0]);
  }

  private updateTaskPagination(
    taskType: TaskListTab,
    updatedPagination: Partial<TaskPageParams>
  ): void {
    this._pagination$.pipe(take(1)).subscribe(pagination => {
      const currentPagination = pagination[taskType];
      this._pagination$.next({
        ...pagination,
        [taskType]: {...currentPagination, ...updatedPagination},
      });
    });
  }

  private updateSortState(taskType: TaskListTab, updatedSortState: SortState): void {
    this._sortState$.pipe(take(1)).subscribe(sortState => {
      this._sortState$.next({
        ...sortState,
        [taskType]: {...sortState[taskType], ...updatedSortState},
      });
    });
  }

  private isNumber(value: any): boolean {
    return typeof value === 'number';
  }

  private getLastAvailablePage(page: number, size: number, collectionSize: number): number {
    if (this.isNumber(page) && this.isNumber(size) && this.isNumber(collectionSize) && page !== 0) {
      const amountOfPages = Math.ceil(collectionSize / size);

      if (page + 1 > amountOfPages) {
        return amountOfPages - 1;
      }
    }

    return page;
  }

  private disableLoadingAnimation(): void {
    this._enableLoadingAnimation$.next(false);
  }

  private enableLoadingAnimation(): void {
    this._enableLoadingAnimation$.next(true);
  }
}
