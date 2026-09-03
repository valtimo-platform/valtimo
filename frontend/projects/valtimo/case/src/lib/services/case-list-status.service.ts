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
import {CaseListService} from './case-list.service';
import {CaseStatusService, InternalCaseStatus} from '@valtimo/document';
import {CaseParameterService} from './case-parameter.service';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  map,
  Observable,
  of,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {CASE_WITHOUT_STATUS_STATUS} from '../constants';
import {CaseListContext} from '../models';

@Injectable()
export class CaseListStatusService {
  private readonly _selectedCaseStatusKeys$ = new BehaviorSubject<string[]>([]);

  private readonly _showStatusSelector$ = new BehaviorSubject<boolean>(false);

  private readonly _caseStatuses$: Observable<Array<InternalCaseStatus>> =
    this.caseListService.context$.pipe(
      filter((ctx): ctx is CaseListContext => !!ctx),
      switchMap(context =>
        combineLatest([
          context.type === 'group'
            ? this.caseStatusService.getGroupInternalCaseStatuses(context.key)
            : this.caseStatusService.getInternalCaseStatuses(context.key),
          this.caseParameterService.queryStatusParams$,
        ]).pipe(take(1))
      ),
      switchMap(([statuses, queryStatuses]) =>
        combineLatest([of([CASE_WITHOUT_STATUS_STATUS, ...statuses]), of(queryStatuses)])
      ),
      tap(([statuses, queryStatuses]) => {
        const selectedStatuses = queryStatuses
          ? statuses.filter(status => queryStatuses.includes(status.key))
          : [
              ...statuses.filter(status => status.visibleInCaseListByDefault),
              CASE_WITHOUT_STATUS_STATUS,
            ];
        this.setSelectedStatuses(selectedStatuses.map((status: InternalCaseStatus) => status.key));
      }),
      map(([statuses]) => statuses),
      tap(statuses => this._showStatusSelector$.next((statuses || []).length > 1))
    );

  public get caseStatuses$(): Observable<Array<InternalCaseStatus>> {
    return this._caseStatuses$;
  }

  public get showStatusSelector$(): Observable<boolean> {
    return this._showStatusSelector$.asObservable();
  }

  public get selectedCaseStatuses$(): Observable<Array<string>> {
    return this._selectedCaseStatusKeys$;
  }

  constructor(
    private readonly caseListService: CaseListService,
    private readonly caseStatusService: CaseStatusService,
    private readonly caseParameterService: CaseParameterService
  ) {}

  public setSelectedStatuses(statusKeys: string[]): void {
    this._selectedCaseStatusKeys$.next(statusKeys);
    this.caseParameterService.setStatusParameter(statusKeys);
  }
}
