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
  OnDestroy,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import {CaseTag, CaseTagService, CaseTagsUtils} from '@valtimo/document';
import {
  BehaviorSubject,
  combineLatest,
  map,
  Subject,
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {ActivatedRoute} from '@angular/router';
import {ActionItem, ColumnConfig, ViewType} from '@valtimo/components';
import {StatusModalCloseEvent, StatusModalType} from '../../../../models';
import {getCaseManagementRouteParams} from '../../../../utils';

@Component({
  standalone: false,
  selector: 'valtimo-case-management-tags',
  templateUrl: './case-management-tags.component.html',
  styleUrls: ['./case-management-tags.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseManagementTagsComponent implements AfterViewInit, OnDestroy {
  @ViewChild('colorColumnTemplate') colorColumnTemplate: TemplateRef<any>;

  private readonly _reload$ = new BehaviorSubject<null | 'noAnimation'>(null);

  private readonly _params$ = getCaseManagementRouteParams(this.route);

  public readonly loading$ = new BehaviorSubject<boolean>(true);

  public readonly caseDefinitionKey$ = this._params$.pipe(map(p => p.caseDefinitionKey));
  public readonly caseDefinitionVersionTag$ = this._params$.pipe(
    map(p => p.caseDefinitionVersionTag)
  );

  public readonly usedKeys$ = new BehaviorSubject<string[]>([]);

  private readonly _subscriptions = new Subscription();

  public readonly caseTags$ = combineLatest([
    this.caseDefinitionKey$,
    this.caseDefinitionVersionTag$,
    this._reload$,
  ]).pipe(
    tap(([_, __, reload]) => {
      if (reload === null) {
        this.loading$.next(true);
      }
    }),
    switchMap(([caseDefinitionKey, caseDefinitionVersionTag]) =>
      this.caseTagService.getCaseTagsManagement(caseDefinitionKey, caseDefinitionVersionTag)
    ),
    map(caseTags =>
      caseTags.map(caseTag => ({
        ...caseTag,
        tagType: CaseTagsUtils.getTagTypeFromCaseTagColor(caseTag.color),
      }))
    ),
    tap(caseTags => {
      this.usedKeys$.next(caseTags.map(caseTag => caseTag.key));
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
  public readonly prefillCaseTag$ = new BehaviorSubject<CaseTag | undefined>(undefined);

  public readonly caseTagToDelete$ = new BehaviorSubject<CaseTag | undefined>(undefined);
  public readonly showDeleteModal$ = new Subject<boolean>();

  constructor(
    private readonly caseTagService: CaseTagService,
    private readonly route: ActivatedRoute
  ) {}

  public ngAfterViewInit(): void {
    this.initFields();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public openDeleteModal(caseTag: CaseTag): void {
    this.caseTagToDelete$.next(caseTag);
    this.showDeleteModal$.next(true);
  }

  public openEditModal(caseTag: CaseTag): void {
    this.prefillCaseTag$.next(caseTag);
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

  public confirmDeleteCaseTag(caseTag: CaseTag): void {
    this._subscriptions.add(
      combineLatest([this.caseDefinitionKey$, this.caseDefinitionVersionTag$])
        .pipe(
          switchMap(([caseDefinitionKey, caseDefinitionVersionTag]) =>
            this.caseTagService.deleteCaseTag(
              caseDefinitionKey,
              caseDefinitionVersionTag,
              caseTag.key
            )
          )
        )
        .subscribe(() => {
          this.reload();
        })
    );
  }

  public onItemsReorderedEvent(reorderedItems: CaseTag[]): void {
    if (!reorderedItems) return;

    combineLatest([this.caseDefinitionKey$, this.caseDefinitionVersionTag$])
      .pipe(
        take(1),
        switchMap(([caseDefinitionKey, caseDefinitionVersionTag]) =>
          this.caseTagService.updateCaseTags(
            caseDefinitionKey,
            caseDefinitionVersionTag,
            reorderedItems
          )
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
        label: 'caseManagement.caseTags.columns.title',
        viewType: ViewType.TEXT,
      },
      {
        key: 'key',
        label: 'caseManagement.caseTags.columns.key',
        viewType: ViewType.TEXT,
      },
      {
        viewType: ViewType.TEMPLATE,
        template: this.colorColumnTemplate,
        key: 'color',
        label: 'caseManagement.caseTags.columns.color',
      },
    ]);
  }
}
