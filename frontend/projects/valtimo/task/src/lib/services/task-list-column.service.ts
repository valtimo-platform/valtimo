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

import {Injectable} from '@angular/core';
import {ColumnConfig, ViewType} from '@valtimo/components';
import {BehaviorSubject, filter, Observable, switchMap, tap} from 'rxjs';
import {TaskService} from './task.service';
import {TaskListColumn} from '../models';
import {TaskListService} from './task-list.service';
import {TaskListSortService} from './task-list-sort.service';

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

  private readonly _fields$ = new BehaviorSubject<ColumnConfig[]>(this._DEFAULT_TASK_LIST_FIELDS);

  private get hasCustomConfigTaskList(): boolean {
    return !!this.taskService.getConfigCustomTaskList();
  }

  public get fields$(): Observable<ColumnConfig[]> {
    return this._fields$.asObservable();
  }

  public get taskListColumnsForCase$(): Observable<TaskListColumn[]> {
    return this.taskListService.caseDefinitionName$.pipe(
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
          this._fields$.next(this._DEFAULT_SPECIFIED_TASK_LIST_FIELDS);
        } else {
          this._fields$.next(this.mapTaskListColumnToColumnConfig(taskListColumns));
        }
      }),
      tap(() => this.taskListService.setLoadingStateForCaseDefinition(false))
    );
  }

  constructor(
    private readonly taskService: TaskService,
    private readonly taskListService: TaskListService,
    private readonly taskListSortService: TaskListSortService
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

  private setFieldsToCustomTaskListFields(): void {
    const customTaskListFields = this.taskService.getConfigCustomTaskList().fields;

    if (customTaskListFields) {
      this._fields$.next(
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
    this._fields$.next(this._DEFAULT_TASK_LIST_FIELDS);
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
