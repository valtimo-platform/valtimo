/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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
import {BehaviorSubject, map, Observable, switchMap, take} from 'rxjs';
import {DossierListService} from './dossier-list.service';
import {DocumentService} from '@valtimo/document';
import {AssigneeFilter, DefinitionColumn} from '@valtimo/config';
import {TranslateService} from '@ngx-translate/core';
import {ListField} from '@valtimo/components';
import {DossierParameterService} from './dossier-parameter.service';

@Injectable()
export class DossierListAssigneeService {
  private readonly ASSIGNEE_KEY = 'assigneeFullName';
  private readonly defaultAssigneeFilter: AssigneeFilter = 'ALL';

  readonly canHaveAssignee$: Observable<boolean> =
    this.dossierListService.documentDefinitionName$.pipe(
      switchMap(documentDefinitionName =>
        this.documentService.getCaseSettings(documentDefinitionName)
      ),
      map(caseSettings => caseSettings?.canHaveAssignee)
    );

  private readonly _assigneeFilter$ = new BehaviorSubject<AssigneeFilter>(
    this.defaultAssigneeFilter
  );

  get assigneeFilter$(): Observable<AssigneeFilter> {
    return this._assigneeFilter$.asObservable();
  }

  constructor(
    private readonly dossierListService: DossierListService,
    private readonly documentService: DocumentService,
    private readonly translateService: TranslateService,
    private readonly dossierParameterService: DossierParameterService
  ) {}

  resetAssigneeFilter(): void {
    this.dossierParameterService.queryAssigneeParam$.pipe(take(1)).subscribe(assigneeParam => {
      if (assigneeParam) {
        this._assigneeFilter$.next(assigneeParam);
        this.dossierParameterService.setAssigneeParameter(assigneeParam);
      } else {
        this._assigneeFilter$.next(this.defaultAssigneeFilter);
        this.dossierParameterService.setAssigneeParameter(this.defaultAssigneeFilter);
      }
    });
  }

  setAssigneeFilter(assigneeFilter: AssigneeFilter): void {
    this._assigneeFilter$.next(assigneeFilter);
    this.dossierParameterService.setAssigneeParameter(assigneeFilter);
  }

  filterAssigneeColumns(
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

  addAssigneeListField(
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