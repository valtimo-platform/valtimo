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
import {BehaviorSubject, Subject, map, Observable, switchMap, take, tap, combineLatest} from 'rxjs';
import {CaseListService} from './case-list.service';
import {DocumentService} from '@valtimo/document';
import {AssigneeFilter, ConfigService, DefinitionColumn} from '@valtimo/shared';
import {TranslateService} from '@ngx-translate/core';
import {ListField} from '@valtimo/components';
import {CaseParameterService} from './case-parameter.service';

@Injectable()
export class CaseListAssigneeService {
  private readonly ASSIGNEE_KEY = 'assigneeFullName';
  private readonly _defaultAssigneeFilter$ = new Subject<AssigneeFilter>();
  private readonly _assigneeFilter$ = new BehaviorSubject<AssigneeFilter | null>(null);

  public readonly canHaveAssignee$: Observable<boolean> =
    this.caseListService.caseDefinitionKey$.pipe(
      switchMap(caseDefinitionKey => this.documentService.getCaseSettings(caseDefinitionKey)),
      map(caseSettings => caseSettings?.canHaveAssignee),
      tap(canHaveAssignee => {
        const visibleTabs: AssigneeFilter[] = this.configService.config.visibleCaseListTabs ?? [];

        this._defaultAssigneeFilter$.next(
          !!visibleTabs && canHaveAssignee ? visibleTabs[0] : 'ALL'
        );
      })
    );

  public get assigneeFilter$(): Observable<AssigneeFilter | null> {
    return this._assigneeFilter$.asObservable();
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly caseListService: CaseListService,
    private readonly documentService: DocumentService,
    private readonly translateService: TranslateService,
    private readonly caseParameterService: CaseParameterService
  ) {}

  public resetAssigneeFilter(): void {
    combineLatest([this.caseParameterService.queryAssigneeParam$, this._defaultAssigneeFilter$])
      .pipe(take(1))
      .subscribe(([assigneeParam, defaultAssigneeFilter]) => {
        if (assigneeParam) {
          this._assigneeFilter$.next(assigneeParam);
          this.caseParameterService.setAssigneeParameter(assigneeParam);
        } else {
          this._assigneeFilter$.next(defaultAssigneeFilter);
          this.caseParameterService.setAssigneeParameter(defaultAssigneeFilter);
        }
      });
  }

  public setAssigneeFilter(assigneeFilter: AssigneeFilter): void {
    this._assigneeFilter$.next(assigneeFilter);
    this.caseParameterService.setAssigneeParameter(assigneeFilter);
  }

  public filterAssigneeColumns(
    columns: Array<DefinitionColumn>,
    canHaveAssignee: boolean
  ): Array<DefinitionColumn> {
    return columns.filter(column => {
      if (column?.key === this.ASSIGNEE_KEY && !canHaveAssignee) {
        return false;
      }
      return true;
    });
  }

  public addAssigneeListField(
    columns: Array<DefinitionColumn>,
    listFields: Array<ListField>,
    canHaveAssignee: boolean
  ): Array<ListField> {
    return [
      ...listFields,
      ...(canHaveAssignee && !columns.find(column => column.propertyName === this.ASSIGNEE_KEY)
        ? [
            {
              key: this.ASSIGNEE_KEY,
              label: this.translateService.instant(`fieldLabels.${this.ASSIGNEE_KEY}`),
              sortable: true,
              viewType: 'string',
            },
          ]
        : []),
    ];
  }
}
