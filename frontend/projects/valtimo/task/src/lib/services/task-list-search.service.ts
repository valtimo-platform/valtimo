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
import {
  ConfigService,
  SearchField,
  SearchFieldValues,
  SearchFilter,
  SearchFilterRange,
} from '@valtimo/config';
import {BehaviorSubject, map, Observable, of, switchMap, tap} from 'rxjs';
import {TaskListService} from './task-list.service';
import {TaskListOtherFilters, TaskListSearchField} from '../models';
import {TaskService} from './task.service';

@Injectable()
export class TaskListSearchService {
  private readonly _loadingSearchFields$ = new BehaviorSubject<boolean>(true);
  private readonly _otherFilters$ = new BehaviorSubject<TaskListOtherFilters>([]);

  public get loadingSearchFields$(): Observable<boolean> {
    return this._loadingSearchFields$.asObservable();
  }

  public get otherFilters$(): Observable<TaskListOtherFilters> {
    return this._otherFilters$.asObservable();
  }

  public readonly searchFields$: Observable<SearchField[]> =
    this.taskListService.caseDefinitionName$.pipe(
      tap(() => this._loadingSearchFields$.next(true)),
      switchMap(caseDefinitionName =>
        caseDefinitionName
          ? this.taskService.getTaskListSearchFields(caseDefinitionName)
          : of([] as TaskListSearchField[])
      ),
      map(searchFields =>
        searchFields.map(searchField => {
          const fieldTypeLowerCase = searchField.fieldType?.toLowerCase();

          return {
            ...searchField,
            dataType: searchField.dataType?.toLowerCase(),
            fieldType: fieldTypeLowerCase === 'text_contains' ? 'single' : fieldTypeLowerCase,
            matchType: searchField?.matchType?.toLowerCase(),
          } as unknown as SearchField;
        })
      ),
      tap(() => this._loadingSearchFields$.next(false))
    );

  constructor(
    private readonly configService: ConfigService,
    private readonly taskListService: TaskListService,
    private readonly taskService: TaskService
  ) {}

  public setSearchFieldValues(searchFieldValues: SearchFieldValues): void {
    this._otherFilters$.next(this.mapSearchValuesToFilters(searchFieldValues));
  }

  public setOtherFilters(otherFilters: TaskListOtherFilters): void {
    this._otherFilters$.next(otherFilters);
  }

  public resetOtherFilters(): void {
    this._otherFilters$.next([]);
  }

  public mapOtherFilterToSearchValues(otherFilters: TaskListOtherFilters): SearchFieldValues {
    return otherFilters.reduce((acc, curr) => {
      const filter = curr as any;

      if (filter.rangeFrom) {
        return {
          ...acc,
          [filter.key]: {
            start: filter.rangeFrom,
            end: filter.rangeTo,
          },
        };
      } else if (filter.multiValue) {
        return {...acc, [filter.key]: filter.values};
      } else if (Array.isArray(filter.values) && filter.values.length > 0 && !filter.multiValue) {
        return {...acc, [filter.key]: filter.values[0]};
      }

      return acc;
    }, {});
  }

  private mapSearchValuesToFilters(values: SearchFieldValues): TaskListOtherFilters {
    const filters: Array<SearchFilter | SearchFilterRange> = [];

    Object.keys(values).forEach(valueKey => {
      const searchValue = values[valueKey] as any;
      if (searchValue.start) {
        filters.push({key: valueKey, rangeFrom: searchValue.start, rangeTo: searchValue.end});
      } else if (Array.isArray(searchValue)) {
        filters.push({key: valueKey, values: searchValue, multiValue: true});
      } else {
        filters.push({key: valueKey, values: [searchValue], multiValue: false});
      }
    });

    return filters;
  }
}
