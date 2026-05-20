/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

import {Injectable} from '@angular/core';
import {ColumnConfig, ListField, ListHiddenColumn, ViewType} from '@valtimo/components';
import {BehaviorSubject, combineLatest, filter, Observable, of, Subject, switchMap, take, tap} from 'rxjs';
import {map} from 'rxjs/operators';
import {TaskService} from './task.service';
import {TaskListColumn} from '../models';
import {TaskListService} from './task-list.service';
import {TaskListSortService} from './task-list-sort.service';
import {TaskListHiddenColumnsService} from './task-list-hidden-columns.service';

@Injectable()
export class TaskListColumnService {
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

  private readonly _DEFAULT_SPECIFIED_TASK_LIST_FIELDS: ColumnConfig[] = [
    {
      key: 'createTime',
      label: `task-list.fieldLabels.created`,
      viewType: ViewType.DATE,
      sortable: true,
      format: 'DD MMM YYYY HH:mm',
    },
    {
      key: 'name',
      label: `task-list.fieldLabels.name`,
      viewType: ViewType.TEXT,
      sortable: true,
    },
    {
      key: 'assignee',
      label: `task-list.fieldLabels.valtimoAssignee.fullName`,
      viewType: ViewType.TEXT,
    },
    {
      key: 'dueDate',
      label: `task-list.fieldLabels.due`,
      viewType: ViewType.TEXT,
      sortable: true,
    },
  ];

  private readonly _availableFields$ = new BehaviorSubject<ColumnConfig[]>(this._DEFAULT_TASK_LIST_FIELDS);
  private readonly _refreshHiddenColumns$ = new Subject<void>();

  private get hasCustomConfigTaskList(): boolean {
    return !!this.taskService.getConfigCustomTaskList();
  }

  public get availableFields$(): Observable<ColumnConfig[]> {
    return this._availableFields$.asObservable();
  }

  public readonly hiddenColumns$: Observable<ListField[]> = this.taskListService.caseDefinitionKey$.pipe(
    switchMap(caseDefinitionKey => {
      if (!caseDefinitionKey || caseDefinitionKey === this.taskListService.ALL_CASES_ID) {
        return of([]);
      }
      return this._refreshHiddenColumns$.pipe(
        switchMap(() => this.hiddenColumnsService.getHiddenColumns(caseDefinitionKey))
      );
    })
  );

  public get fields$(): Observable<ColumnConfig[]> {
    return combineLatest([this._availableFields$, this.hiddenColumns$]).pipe(
      map(([availableFields, hiddenColumns]) => {
        if (!hiddenColumns || hiddenColumns.length === 0) {
          return availableFields;
        }
        const hiddenKeys = new Set(hiddenColumns.map(col => col.key));
        return availableFields.filter(field => !hiddenKeys.has(field.key));
      })
    );
  }

  public readonly taskListColumnsForCase$: Observable<TaskListColumn[]> = this.taskListService.caseDefinitionKey$.pipe(
    tap(caseDefinitionName => {
      if (caseDefinitionName === this.taskListService.ALL_CASES_ID) {
        this.resetTaskListFields();
      }
    }),
    filter(
      caseDefinitionName =>
        !!caseDefinitionName && caseDefinitionName !== this.taskListService.ALL_CASES_ID
    ),
    switchMap(caseDefinitionName => this.taskService.getTaskListColumns(caseDefinitionName)),
    tap(taskListColumns => {
      if (taskListColumns.length === 0) {
        this.taskListSortService.updateSortStates({
          isSorting: true,
          state: {
            name: this._DEFAULT_SPECIFIED_TASK_LIST_FIELDS[0].key,
            direction: 'DESC',
          },
        });
        this._availableFields$.next(this._DEFAULT_SPECIFIED_TASK_LIST_FIELDS);
      } else {
        this._availableFields$.next(this.mapTaskListColumnToColumnConfig(taskListColumns));
      }
      this._refreshHiddenColumns$.next();
    }),
    tap(() => this.taskListService.setLoadingStateForCaseDefinition(false))
  );

  constructor(
    private readonly taskService: TaskService,
    private readonly taskListService: TaskListService,
    private readonly taskListSortService: TaskListSortService,
    private readonly hiddenColumnsService: TaskListHiddenColumnsService
  ) {}

  public resetTaskListFields(): void {
    if (this.hasCustomConfigTaskList) {
      this.setFieldsToCustomTaskListFields();
    } else {
      this.setFieldsToDefaultTaskListFields();
    }

    this.taskListSortService.resetDefaultSortStates();
    this.taskListService.setLoadingStateForCaseDefinition(false);
  }

  public saveHiddenColumns(hiddenColumns: ListHiddenColumn[]): void {
    this.taskListService.caseDefinitionKey$.pipe(take(1)).subscribe(caseDefinitionKey => {
      if (caseDefinitionKey && caseDefinitionKey !== this.taskListService.ALL_CASES_ID) {
        this.hiddenColumnsService
          .saveHiddenColumns(caseDefinitionKey, hiddenColumns)
          .subscribe(() => this._refreshHiddenColumns$.next());
      }
    });
  }

  private setFieldsToCustomTaskListFields(): void {
    const customTaskListFields = this.taskService.getConfigCustomTaskList().fields;

    if (customTaskListFields) {
      this._availableFields$.next(
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

  private setFieldsToDefaultTaskListFields(): void {
    this._availableFields$.next(this._DEFAULT_TASK_LIST_FIELDS);
  }

  private mapTaskListColumnToColumnConfig(
    taskListColumns: Array<TaskListColumn>
  ): Array<ColumnConfig> {
    const hasDefaultSort = !!taskListColumns.find(column => column.defaultSort);
    const firstSortableColumn = taskListColumns.find(column => column.sortable);

    if (!hasDefaultSort && firstSortableColumn) {
      this.taskListSortService.updateSortStates({
        isSorting: true,
        state: {
          name: firstSortableColumn.key,
          direction: 'DESC',
        },
      });
    }

    if (!hasDefaultSort && !firstSortableColumn) {
      this.taskListSortService.clearSortStates();
    }

    return taskListColumns.map(column => {
      if (column.defaultSort) {
        this.taskListSortService.updateSortStates({
          isSorting: true,
          state: {
            name: column.key,
            direction: column.defaultSort,
          },
        });
      }

      return {
        viewType: this.getViewType(column.displayType.type),
        key: column.key,
        label: column.title || column.key,
        sortable: column.sortable,
        ...(column?.displayType?.displayTypeParameters?.enum && {
          enum: column?.displayType?.displayTypeParameters?.enum,
        }),
        ...(column?.displayType?.displayTypeParameters?.dateFormat && {
          format: column?.displayType?.displayTypeParameters?.dateFormat,
        }),
      };
    });
  }

  private getViewType(taskListColumnColumnDisplayType: string): string {
    switch (taskListColumnColumnDisplayType) {
      case 'arrayCount':
        return 'relatedFiles';
      case 'underscoresToSpaces':
        return 'stringReplaceUnderscore';
      default:
        return taskListColumnColumnDisplayType;
    }
  }
}
