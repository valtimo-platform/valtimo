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

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  signal,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import {CaseTagService, CaseTag, CaseTagsUtils} from '@valtimo/document';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  map,
  Observable,
  Subject,
  switchMap,
  tap,
  Subscription,
} from 'rxjs';
import {ActivatedRoute} from '@angular/router';
import {ActionItem, ColumnConfig, ViewType} from '@valtimo/components';
import {StatusModalCloseEvent, StatusModalType} from '../../models';

@Component({
  selector: 'valtimo-dossier-management-case-tags',
  templateUrl: './dossier-management-case-tags.component.html',
  styleUrls: ['./dossier-management-case-tags.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DossierManagementCaseTagComponent implements AfterViewInit, OnDestroy {
  @ViewChild('colorColumnTemplate') colorColumnTemplate: TemplateRef<any>;

  private readonly _reload$ = new BehaviorSubject<null | 'noAnimation'>(null);

  private readonly _documentDefinitionName$: Observable<string> = this.route.params.pipe(
    map(params => params?.name),
    filter(docDefName => !!docDefName)
  );

  public get documentDefinitionName$(): Observable<string> {
    return this._documentDefinitionName$;
  }

  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly dragAndDropDisabled = signal(false);
  public readonly usedKeys$ = new BehaviorSubject<string[]>([]);

  private _documentCaseTags: CaseTag[] = [];
  private _subscriptions = new Subscription();

  public readonly documentCaseTags$ = combineLatest([
    this._documentDefinitionName$,
    this._reload$,
  ]).pipe(
    tap(([_, reload]) => {
      if (reload === null) {
        this.loading$.next(true);
      }
    }),
    switchMap(([documentDefinitionName]) =>
      this.caseTagService.getCaseTagsManagement(documentDefinitionName)
    ),
    map(caseTags =>
      caseTags.map(caseTag => ({
        ...caseTag,
        tagType: CaseTagsUtils.getTagTypeFromCaseTagColor(caseTag.color),
      }))
    ),
    tap(caseTags => {
      this._documentCaseTags = caseTags;
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
  public readonly prefillCaseTag$ = new BehaviorSubject<CaseTag>(undefined);

  public readonly caseTagToDelete$ = new BehaviorSubject<CaseTag>(undefined);
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
      this.documentDefinitionName$
        .pipe(
          switchMap(documentDefinitionName =>
            this.caseTagService.deleteCaseTag(documentDefinitionName, caseTag.key)
          )
        )
        .subscribe(() => {
          this.reload();
        })
    );
  }

  public onItemsReorderedEvent(reorderedItems: CaseTag[]): void {
    if (!reorderedItems) return;

    this.dragAndDropDisabled.set(true);
    this._subscriptions.add(
      this.documentDefinitionName$
        .pipe(
          switchMap(documentDefinitionName =>
            this.caseTagService.updateCaseTags(documentDefinitionName, reorderedItems)
          )
        )
        .subscribe(() => {
          this.reload(true);
        })
    );
    this.dragAndDropDisabled.set(false);
  }

  private reload(noAnimation = false): void {
    this._reload$.next(noAnimation ? 'noAnimation' : null);
  }

  private initFields(): void {
    this.fields$.next([
      {
        key: 'title',
        label: 'dossierManagement.caseTags.columns.title',

        viewType: ViewType.TEXT,
      },
      {
        key: 'key',
        label: 'dossierManagement.caseTags.columns.key',

        viewType: ViewType.TEXT,
      },
      {
        viewType: ViewType.TEMPLATE,
        template: this.colorColumnTemplate,
        key: 'color',
        label: 'dossierManagement.caseTags.columns.color',
      },
    ]);
  }
}
