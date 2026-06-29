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

import {Injectable} from '@angular/core';
import {TaskPageParams} from '../models';
import {BehaviorSubject, combineLatest, Observable} from 'rxjs';
import {TaskListTab, UserSettingsService} from '@valtimo/shared';
import {map, switchMap, take} from 'rxjs/operators';
import {TaskListService} from './task-list.service';

@Injectable()
export class TaskListPaginationService {
  private readonly _pagination$ = new BehaviorSubject<{[key in TaskListTab]: TaskPageParams}>({
    [TaskListTab.ALL]: this.getDefaultPagination(),
    [TaskListTab.MINE]: this.getDefaultPagination(),
    [TaskListTab.OPEN]: this.getDefaultPagination(),
    [TaskListTab.TEAM]: this.getDefaultPagination(),
  });

  private readonly _paginationForCurrentTaskType$: Observable<TaskPageParams> = combineLatest([
    this.taskListService.selectedTaskType$,
    this._pagination$,
  ]).pipe(map(([selectedTaskType, pagination]) => pagination[selectedTaskType]));

  public get paginationForCurrentTaskType$(): Observable<TaskPageParams> {
    return this._paginationForCurrentTaskType$;
  }

  public get paginationForCurrentTaskTypeForList$(): Observable<TaskPageParams> {
    return this._paginationForCurrentTaskType$.pipe(
      map(pagination => ({...pagination, page: pagination?.page + 1 || 1}))
    );
  }

  private _caseDefinitionKey: string | null = null;

  constructor(
    private readonly taskListService: TaskListService,
    private readonly userSettingsService: UserSettingsService
  ) {}

  public updateTaskPagination(
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

  public getLastAvailablePage(page: number, size: number, collectionSize: number): number {
    if (this.isNumber(page) && this.isNumber(size) && this.isNumber(collectionSize) && page !== 0) {
      const amountOfPages = Math.ceil(collectionSize / size);

      if (page + 1 > amountOfPages) {
        return amountOfPages - 1;
      }
    }

    return page;
  }

  private isNumber(value: any): boolean {
    return typeof value === 'number';
  }

  public loadPageSizeForCaseDefinition(caseDefinitionKey: string | null): void {
    this._caseDefinitionKey = caseDefinitionKey;

    if (!caseDefinitionKey) return;

    this.userSettingsService.getUserSettings().pipe(take(1)).subscribe(settings => {
      const savedSize = settings?.taskListPageSizes?.[caseDefinitionKey];
      if (savedSize) {
        this._pagination$.pipe(take(1)).subscribe(pagination => {
          const updated = {...pagination};
          for (const tab of Object.values(TaskListTab)) {
            updated[tab] = {...updated[tab], size: savedSize, page: 0};
          }
          this._pagination$.next(updated);
        });
      }
    });
  }

  public savePageSizePreference(size: number): void {
    if (!this._caseDefinitionKey) return;

    const caseDefinitionKey = this._caseDefinitionKey;
    this.userSettingsService.getUserSettings().pipe(
      take(1),
      switchMap(settings => {
        const pageSizes = {...(settings?.taskListPageSizes || {}), [caseDefinitionKey]: size};
        return this.userSettingsService.saveUserSettings({...settings, taskListPageSizes: pageSizes});
      })
    ).subscribe();
  }

  private getDefaultPagination(): TaskPageParams {
    return {
      page: 0,
      size: 10,
    };
  }
}
