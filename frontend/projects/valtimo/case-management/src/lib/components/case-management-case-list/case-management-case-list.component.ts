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
import {ChangeDetectionStrategy, Component} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {
  CaseManagementParams,
  DraftVersionService,
  getCaseManagementRouteParams,
} from '@valtimo/shared';
import {BehaviorSubject, switchMap, of, Observable} from 'rxjs';
import {TabEnum} from '../../models';

@Component({
  standalone: false,
  templateUrl: './case-management-case-list.component.html',
  styleUrl: './case-management-case-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseManagementCaseListComponent {
  public readonly isDraftVersion$: Observable<boolean> = getCaseManagementRouteParams(
    this.route
  ).pipe(
    switchMap((params: CaseManagementParams | undefined) =>
      !params
        ? of(false)
        : this.draftVersionService.isDraftVersion(
            params.caseDefinitionKey,
            params.caseDefinitionVersionTag
          )
    )
  );
  public readonly currentTab$ = new BehaviorSubject<TabEnum>(TabEnum.SEARCH);
  public readonly DRAFT_WARNING_MESSAGE = {
    [TabEnum.SEARCH]: 'caseManagement.tabs.caseListTab.searchFields',
    [TabEnum.LIST]: 'caseManagement.tabs.caseListTab.columns',
  };
  public readonly TabEnum = TabEnum;

  constructor(
    private readonly draftVersionService: DraftVersionService,
    private readonly route: ActivatedRoute
  ) {}

  public switchTab(tab: TabEnum): void {
    this.currentTab$.next(tab);
  }
}
