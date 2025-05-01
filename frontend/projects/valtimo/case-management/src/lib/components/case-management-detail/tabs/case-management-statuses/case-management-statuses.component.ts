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

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import {CaseStatusService, InternalCaseStatus, InternalCaseStatusUtils} from '@valtimo/document';
import {BehaviorSubject, combineLatest, map, Subject, switchMap, tap} from 'rxjs';
import {ActivatedRoute} from '@angular/router';
import {ActionItem, ColumnConfig, ViewType} from '@valtimo/components';
import {StatusModalCloseEvent, StatusModalType} from '../../../../models';
import {getCaseManagementRouteParams} from '../../../../utils';

@Component({
  standalone: false,
  templateUrl: './case-management-statuses.component.html',
  styleUrls: ['./case-management-statuses.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseManagementStatusesComponent implements AfterViewInit {
  @ViewChild('colorColumnTemplate') colorColumnTemplate: TemplateRef<any>;

  private readonly _reload$ = new BehaviorSubject<null | 'noAnimation'>(null);

  private readonly _params$ = getCaseManagementRouteParams(this.route);

  public readonly caseDefinitionKey$ = this._params$.pipe(map(params => params.caseDefinitionKey));

  public readonly loading$ = new BehaviorSubject<boolean>(true);

  public readonly usedKeys$ = new BehaviorSubject<string[]>([]);

  public readonly caseStatuses$ = combineLatest([this.caseDefinitionKey$, this._reload$]).pipe(
    tap(([_, reload]) => {
      if (reload === null) {
        this.loading$.next(true);
      }
    }),
    switchMap(([caseDefinitionKey]) =>
      this.caseStatusService.getInternalCaseStatusesManagement(caseDefinitionKey)
    ),
    map(statuses =>
      statuses.map(status => ({
        ...status,
        tagType: InternalCaseStatusUtils.getTagTypeFromInternalCaseStatusColor(status.color),
      }))
    ),
    tap(statuses => {
      this.usedKeys$.next(statuses.map(status => status.key));
      this.loading$.next(false);
    })
  );

  public readonly fields$ = new BehaviorSubject<ColumnConfig[]>([]);

  public readonly ACTION_ITEMS: ActionItem[] = [
    {
      label: 'interface.edit',
      callback: this.openEditModal.bind(this),
      type: 'normal',
    },
    {
      label: 'interface.delete',
      callback: this.openDeleteModal.bind(this),
      type: 'danger',
    },
  ];

  public readonly statusModalType$ = new BehaviorSubject<StatusModalType>('closed');
  public readonly prefillStatus$ = new BehaviorSubject<InternalCaseStatus>(undefined);

  public readonly statusToDelete$ = new BehaviorSubject<InternalCaseStatus>(undefined);
  public readonly showDeleteModal$ = new Subject<boolean>();

  constructor(
    private readonly caseStatusService: CaseStatusService,
    private readonly route: ActivatedRoute
  ) {}

  public ngAfterViewInit(): void {
    this.initFields();
  }

  public openDeleteModal(status: InternalCaseStatus): void {
    this.statusToDelete$.next(status);
    this.showDeleteModal$.next(true);
  }

  public openEditModal(status: InternalCaseStatus): void {
    this.prefillStatus$.next(status);
    this.statusModalType$.next('edit');
  }

  public openAddModal(): void {
    this.statusModalType$.next('add');
  }

  public closeModal(closeModalEvent: StatusModalCloseEvent): void {
    if (closeModalEvent === 'closeAndRefresh') {
      this.reload();
    }

    this.statusModalType$.next('closed');
  }

  public confirmDeleteStatus(status: InternalCaseStatus): void {
    this.caseDefinitionKey$
      .pipe(
        switchMap(caseDefinitionKey =>
          this.caseStatusService.deleteInternalCaseStatus(caseDefinitionKey, status.key)
        )
      )
      .subscribe(() => {
        this.reload();
      });
  }

  public onItemsReordered(reorderedItems: InternalCaseStatus[]): void {
    this.caseDefinitionKey$
      .pipe(
        switchMap(caseDefinitionKey =>
          this.caseStatusService.updateInternalCaseStatuses(caseDefinitionKey, reorderedItems)
        )
      )
      .subscribe(() => {
        this.reload(true);
      });
  }

  private reload(noAnimation = false): void {
    this._reload$.next(noAnimation ? 'noAnimation' : null);
  }

  private initFields(): void {
    this.fields$.next([
      {
        key: 'title',
        label: 'caseManagement.statuses.columns.title',
        viewType: ViewType.TEXT,
      },
      {
        key: 'key',
        label: 'caseManagement.statuses.columns.key',
        viewType: ViewType.TEXT,
      },
      {
        key: 'visibleInCaseListByDefault',
        label: 'caseManagement.statuses.columns.visible',
        viewType: ViewType.BOOLEAN,
      },
      {
        viewType: ViewType.TEMPLATE,
        template: this.colorColumnTemplate,
        key: 'color',
        label: 'caseManagement.statuses.columns.color',
      },
    ]);
  }
}
