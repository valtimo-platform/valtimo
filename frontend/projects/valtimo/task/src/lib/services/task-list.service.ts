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
import {BehaviorSubject, Observable} from 'rxjs';
import {TaskService} from './task.service';
import {TaskListTab} from '@valtimo/config';

@Injectable()
export class TaskListService {
  private readonly _ALL_CASES_ID = 'ALL_CASES';
  private readonly _caseDefinitionName$ = new BehaviorSubject<string | null>(null);
  private readonly _selectedTaskType$ = new BehaviorSubject<TaskListTab>(TaskListTab.MINE);
  private readonly _loadingStateForCaseDefinition$ = new BehaviorSubject<boolean>(false);

  public get caseDefinitionName$(): Observable<string | null> {
    return this._caseDefinitionName$.asObservable();
  }

  public get selectedTaskType$(): Observable<TaskListTab> {
    return this._selectedTaskType$.asObservable();
  }

  public get selectedTaskType(): TaskListTab {
    return this._selectedTaskType$.getValue();
  }

  public get loadingStateForCaseDefinition$(): Observable<boolean> {
    return this._loadingStateForCaseDefinition$.asObservable();
  }

  public get ALL_CASES_ID(): string {
    return this._ALL_CASES_ID;
  }

  constructor(private readonly taskService: TaskService) {}

  public setSelectedTaskType(type: TaskListTab): void {
    this._selectedTaskType$.next(type);
  }

  public setCaseDefinitionName(caseDefinitionName: string): void {
    this._loadingStateForCaseDefinition$.next(true);
    this._caseDefinitionName$.next(caseDefinitionName);
  }

  public setLoadingStateForCaseDefinition(loading: boolean): void {
    this._loadingStateForCaseDefinition$.next(loading);
  }
}
