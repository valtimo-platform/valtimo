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
import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, ViewChild} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {
  ActionItem,
  CarbonListComponent,
  CarbonListItem,
  CarbonListModule,
  ColumnConfig,
  ConfirmationModalModule,
  Pagination,
  ViewType,
} from '@valtimo/components';
import {CaseManagementParams, getCaseManagementRouteParams} from '@valtimo/shared';
import {Page} from '@valtimo/document';
import {ButtonModule, IconModule, TagModule} from 'carbon-components-angular';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  map,
  Observable,
  startWith,
  Subject,
  switchMap,
  tap,
} from 'rxjs';
import {DocumentenApiColumnModalTypeCloseEvent} from '../../models';
import {DocumentenApiTag} from '../../models/documenten-api-tag.model';
import {DocumentenApiTagService} from '../../services/documenten-api-tag.service';
import {DocumentenApiTagModalComponent} from '../documenten-api-tag-modal/documenten-api-tag-modal.component';

@Component({
  selector: 'valtimo-documenten-api-tags',
  templateUrl: './documenten-api-tags.component.html',
  styleUrls: ['./documenten-api-tags.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    CarbonListModule,
    TranslateModule,
    ConfirmationModalModule,
    TagModule,
    ButtonModule,
    DocumentenApiTagModalComponent,
    IconModule,
  ],
})
export class DocumentenApiTagsComponent {
  @ViewChild(CarbonListComponent) carbonList: CarbonListComponent;

  private readonly _reload$ = new BehaviorSubject<null | 'noAnimation'>(null);
  public readonly caseDefinitionKey$: Observable<string> = getCaseManagementRouteParams(
    this.route
  ).pipe(
    map((params: CaseManagementParams | undefined) => params?.caseDefinitionKey ?? ''),
    filter((caseDefinitionKey: string) => !!caseDefinitionKey)
  );

  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly fields$ = new BehaviorSubject<ColumnConfig[]>([]);
  public readonly addModalClosed$ = new BehaviorSubject<boolean>(true);
  public readonly showDeleteMultipleModal$ = new BehaviorSubject<boolean>(false);
  public readonly showDeleteModal$ = new Subject<boolean>();
  public readonly selectedRowKeys$ = new BehaviorSubject<Array<string>>([]);
  public readonly searchTerm$ = new BehaviorSubject<string>('');
  public readonly tagToDelete$ = new BehaviorSubject<DocumentenApiTag | null>(null);

  public readonly documentTags$: Observable<DocumentenApiTag[]> = combineLatest([
    this.caseDefinitionKey$,
    this.searchTerm$,
    this._reload$,
  ]).pipe(
    tap(([_1, _2, reload]) => {
      if (reload === null) this.loading$.next(true);
    }),
    switchMap(([caseDefinitionKey, searchTerm]) =>
      this.documentenApiTagService.getTagsForAdmin(caseDefinitionKey, {
        page: this.pagination.page - 1,
        size: this.pagination.size,
        search: searchTerm,
      })
    ),
    map((tagPage: Page<DocumentenApiTag>) => {
      this.pagination = {
        ...this.pagination,
        collectionSize: tagPage.totalElements,
      };

      return tagPage.content;
    }),
    startWith([]),
    tap(() => {
      this.loading$.next(false);
    })
  );

  public readonly ACTION_ITEMS: ActionItem[] = [
    {
      label: 'interface.delete',
      callback: this.openDeleteModal.bind(this),
      type: 'danger',
    },
  ];

  public readonly FIELDS: ColumnConfig[] = [
    {
      key: 'value',
      label: 'zgw.tags.fields.value',
      viewType: ViewType.TEXT,
    },
  ];

  public pagination: Pagination = {
    collectionSize: 0,
    page: 1,
    size: 10,
  };

  constructor(
    private readonly route: ActivatedRoute,
    private readonly documentenApiTagService: DocumentenApiTagService
  ) {}

  public openDeleteModal(tag: DocumentenApiTag): void {
    this.tagToDelete$.next(tag);
    this.showDeleteModal$.next(true);
  }

  public openAddModal(): void {
    this.addModalClosed$.next(false);
  }

  public closeModal(closeModalEvent: DocumentenApiColumnModalTypeCloseEvent): void {
    if (closeModalEvent === 'closeAndRefresh') this.reload();

    this.addModalClosed$.next(true);
  }

  public showDeleteMultipleModal(): void {
    this.setSelectedRoleKeys();
    this.showDeleteMultipleModal$.next(true);
  }

  private setSelectedRoleKeys(): void {
    this.selectedRowKeys$.next(
      this.carbonList.selectedItems.map((item: CarbonListItem) => item.value)
    );
  }

  public paginationClicked(page: number): void {
    this.pagination = {...this.pagination, page};
    this.reload();
  }

  public paginationSet(size: number): void {
    this.pagination = {...this.pagination, size};
    this.reload();
  }

  public confirmDeleteTag(tag: DocumentenApiTag): void {
    this.caseDefinitionKey$
      .pipe(
        switchMap(caseDefinitionKey =>
          this.documentenApiTagService.deleteTag(caseDefinitionKey, tag.value)
        )
      )
      .subscribe(() => {
        this.reload();
      });
  }

  public confirmDeleteMultipleTag(tagsToDelete: {
    caseDefinitionKey: string;
    tagIds: string[];
    itemsOnCurrentPage: number;
  }): void {
    this.documentenApiTagService
      .deleteTags(tagsToDelete.caseDefinitionKey, tagsToDelete.tagIds)
      .subscribe(() => {
        const lastPage = Math.ceil(
          (this.pagination.collectionSize as number) / this.pagination.size
        );
        if (
          tagsToDelete.itemsOnCurrentPage <= tagsToDelete.tagIds.length &&
          this.pagination.page > 1 &&
          this.pagination.page === lastPage
        ) {
          this.pagination = {...this.pagination, page: this.pagination.page - 1};
        }
        this.reload();
      });
  }

  public searchTermEntered(searchTerm: string): void {
    this.pagination = {...this.pagination, page: 1};
    this.searchTerm$.next(searchTerm);
  }

  private reload(noAnimation = false): void {
    this._reload$.next(noAnimation ? 'noAnimation' : null);
  }
}
