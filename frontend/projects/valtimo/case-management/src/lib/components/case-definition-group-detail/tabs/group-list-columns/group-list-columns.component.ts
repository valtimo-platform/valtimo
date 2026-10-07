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

import {ChangeDetectionStrategy, Component, OnDestroy, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {Add16} from '@carbon/icons';
import {GroupListColumn} from '@valtimo/document';
import {ActionItem, CarbonListModule, ColumnConfig, ViewType} from '@valtimo/components';
import {ButtonModule, IconModule, IconService, TableModule} from 'carbon-components-angular';
import {GlobalNotificationService} from '@valtimo/shared';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  Observable,
  shareReplay,
  startWith,
  Subscription,
  take,
} from 'rxjs';
import {CaseDefinitionGroupManagementService} from '../../../../services';
import {GroupPathMapping} from '../../../../models';
import {CASE_DEFINITION_GROUP_ITEM_LIST_TEST_IDS} from '../../../../constants';
import {CaseDefinitionGroupDetailService} from '../../case-definition-group-detail.service';
import {GroupColumnModalComponent} from './group-column-modal/group-column-modal.component';
import {GroupPathMappingEditorComponent} from '../../shared/group-path-mapping-editor/group-path-mapping-editor.component';

interface ColumnWithMappings extends GroupListColumn {
  pathMappings?: GroupPathMapping[];
}

@Component({
  standalone: true,
  selector: 'valtimo-group-list-columns',
  templateUrl: './group-list-columns.component.html',
  styleUrl: './group-list-columns.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ButtonModule,
    IconModule,
    TableModule,
    CarbonListModule,
    GroupColumnModalComponent,
    GroupPathMappingEditorComponent,
  ],
})
export class GroupListColumnsComponent implements OnInit, OnDestroy {
  protected readonly testIds = CASE_DEFINITION_GROUP_ITEM_LIST_TEST_IDS;

  public readonly searchControl = new FormControl('');

  public readonly fields: ColumnConfig[] = [
    {viewType: ViewType.TEXT, sortable: false, key: 'name', label: 'caseManagement.listColumns.name'},
    {viewType: ViewType.TEXT, sortable: false, key: 'key', label: 'caseManagement.listColumns.key'},
    {
      viewType: ViewType.TEXT,
      sortable: false,
      key: 'displayType.type',
      label: 'caseManagement.groups.listColumns.displayType',
    },
    {
      viewType: ViewType.BOOLEAN,
      sortable: false,
      key: 'sortable',
      label: 'caseManagement.groups.listColumns.sortable',
    },
  ];

  public readonly actionItems: ActionItem[] = [
    {label: 'interface.edit', callback: this.showEditModal.bind(this)},
    {label: 'interface.delete', callback: this.deleteColumn.bind(this), type: 'danger'},
  ];

  private readonly _subscriptions = new Subscription();
  private readonly _columns$ = new BehaviorSubject<ColumnWithMappings[]>([]);
  private readonly _pathMappingsCache = new Map<string, Observable<GroupPathMapping[]>>();

  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly usedKeys$ = this._columns$.pipe(map(cols => cols.map(c => c.key)));

  private readonly _searchTerm$ = this.searchControl.valueChanges.pipe(
    startWith(''),
    map(search => (search ?? '').trim().toLowerCase())
  );

  // Reordering a filtered subset would drop the hidden rows on save.
  public readonly filtering$ = this._searchTerm$.pipe(map(term => !!term));

  public readonly filteredColumns$ = combineLatest([this._columns$, this._searchTerm$]).pipe(
    map(([columns, term]) =>
      columns
        .filter(
          c =>
            !term ||
            c.key.toLowerCase().includes(term) ||
            (c.title && c.title.toLowerCase().includes(term))
        )
        .map(c => ({...c, name: c.title || c.key}))
    )
  );

  public readonly group$ = this.detailService.group$;

  public readonly showModal$ = new BehaviorSubject<boolean>(false);
  public readonly editingColumn$ = new BehaviorSubject<ColumnWithMappings | null>(null);

  constructor(
    private readonly detailService: CaseDefinitionGroupDetailService,
    private readonly groupService: CaseDefinitionGroupManagementService,
    private readonly translateService: TranslateService,
    private readonly notificationService: GlobalNotificationService,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Add16]);
  }

  public ngOnInit(): void {
    this._loadGroupAndColumns();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public showAddModal(): void {
    this.editingColumn$.next(null);
    this.showModal$.next(true);
  }

  public showEditModal(column: ColumnWithMappings): void {
    this.pathMappings$(column.key)
      .pipe(take(1))
      .subscribe(pathMappings => {
        this.editingColumn$.next({...this._findColumn(column.key), pathMappings});
        this.showModal$.next(true);
      });
  }

  public onCloseModal(saved: boolean): void {
    this.showModal$.next(false);
    this.editingColumn$.next(null);
    if (saved) this._loadColumns();
  }

  // Fetched once per column, when its row is first expanded or edited.
  public pathMappings$(columnKey: string): Observable<GroupPathMapping[]> {
    const groupKey = this.detailService.currentGroup?.key;
    if (!groupKey) return new BehaviorSubject<GroupPathMapping[]>([]);

    if (!this._pathMappingsCache.has(columnKey)) {
      this._pathMappingsCache.set(
        columnKey,
        this.groupService
          .getListColumnPathMappings(groupKey, columnKey)
          .pipe(shareReplay({bufferSize: 1, refCount: false}))
      );
    }

    return this._pathMappingsCache.get(columnKey) as Observable<GroupPathMapping[]>;
  }

  public onItemsReordered(columns: ColumnWithMappings[]): void {
    const reordered = columns.map(column => this._findColumn(column.key));
    this._columns$.next(reordered);
    this._saveColumnOrder(reordered);
  }

  public deleteColumn(column: GroupListColumn): void {
    const columns = this._columns$.value.filter(c => c.key !== column.key);
    this._columns$.next(columns);
    this._saveColumnOrder(columns);
  }

  private _findColumn(key: string): ColumnWithMappings {
    return this._columns$.value.find(c => c.key === key) as ColumnWithMappings;
  }

  private _loadGroupAndColumns(): void {
    this._subscriptions.add(
      this.group$
        .pipe(
          filter(group => !!group),
          map(group => group.key),
          distinctUntilChanged()
        )
        .subscribe(() => this._loadColumns())
    );
  }

  private _loadColumns(): void {
    const groupKey = this.detailService.currentGroup?.key;
    if (!groupKey) return;

    this._pathMappingsCache.clear();

    this.groupService.getListColumns(groupKey).subscribe(columns => {
      this._columns$.next(columns.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
      this.loading$.next(false);
    });
  }

  private _saveColumnOrder(columns: ColumnWithMappings[]): void {
    const groupKey = this.detailService.currentGroup?.key;
    if (!groupKey) return;

    const requests = columns.map(c => ({
      key: c.key,
      title: c.title,
      displayType: c.displayType,
      sortable: c.sortable,
      defaultSort: c.sortable ? c.defaultSort : undefined,
      exportable: c.exportable,
    }));

    this.groupService.updateListColumns(groupKey, requests).subscribe({
      error: () => {
        this.notificationService.showToast({
          type: 'error',
          title: this.translateService.instant('caseManagement.groups.listColumns.saveError'),
        });
      },
    });
  }
}
