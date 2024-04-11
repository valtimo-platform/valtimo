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
import {BehaviorSubject, combineLatest, Observable} from 'rxjs';
import {SortState, TaskListTab} from '@valtimo/config';
import {TaskService} from './task.service';
import {map, take} from 'rxjs/operators';
import {TaskListService} from './task-list.service';

@Injectable()
export class TaskListSortService {
  private readonly _sortState$ = new BehaviorSubject<{[key in TaskListTab]: SortState | null}>({
    [TaskListTab.ALL]: this._defaultSortState,
    [TaskListTab.MINE]: this._defaultSortState,
    [TaskListTab.OPEN]: this._defaultSortState,
  });

  private readonly _sortStateForCurrentTaskType$: Observable<SortState> = combineLatest([
    this.taskListService.selectedTaskType$,
    this._sortState$,
  ]).pipe(map(([selectedTaskType, sortStates]) => sortStates[selectedTaskType]));

  public get sortStateForCurrentTaskType$(): Observable<SortState> {
    return this._sortStateForCurrentTaskType$;
  }

  public get sortStringForCurrentTaskType$(): Observable<string | null> {
    return this.sortStateForCurrentTaskType$.pipe(
      map(sortState => (sortState ? this.getSortString(sortState) : null))
    );
  }

  private get _defaultSortState(): SortState | null {
    return this.taskService.getConfigCustomTaskList()?.defaultSortedColumn || null;
  }

  constructor(
    private readonly taskService: TaskService,
    private readonly taskListService: TaskListService
  ) {}

  public updateSortState(taskType: TaskListTab, updatedSortState: SortState): void {
    this._sortState$.pipe(take(1)).subscribe(sortState => {
      this._sortState$.next({
        ...sortState,
        [taskType]: {...sortState[taskType], ...updatedSortState},
      });
    });
  }

  public updateSortStates(updatedSortState: SortState): void {
    this._sortState$.pipe(take(1)).subscribe(sortStates => {
      const sortStatesCopy = {...sortStates};

      Object.keys(sortStates).forEach(taskType => {
        sortStatesCopy[taskType] = {...sortStatesCopy[taskType], ...updatedSortState};
      });

      this._sortState$.next(sortStatesCopy);
    });
  }

  public clearSortStates(): void {
    this._sortState$.pipe(take(1)).subscribe(sortStates => {
      const sortStatesCopy = {...sortStates};

      Object.keys(sortStates).forEach(taskType => {
        sortStatesCopy[taskType] = null;
      });

      this._sortState$.next(sortStatesCopy);
    });
  }

  public resetDefaultSortStates(): void {
    this._sortState$.pipe(take(1)).subscribe(sortStates => {
      const sortStatesCopy = {...sortStates};

      Object.keys(sortStates).forEach(taskType => {
        sortStatesCopy[taskType] = this._defaultSortState;
      });

      this._sortState$.next(sortStatesCopy);
    });
  }

  private getSortString(sort: SortState | null): string {
    return `${sort.state.name},${sort.state.direction}`;
  }
}
