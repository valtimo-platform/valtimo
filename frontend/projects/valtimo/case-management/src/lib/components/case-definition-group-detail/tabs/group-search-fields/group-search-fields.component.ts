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
import {GroupSearchField} from '@valtimo/document';
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
import {GroupSearchFieldModalComponent} from './group-search-field-modal/group-search-field-modal.component';
import {GroupPathMappingEditorComponent} from '../../shared/group-path-mapping-editor/group-path-mapping-editor.component';

interface SearchFieldWithMappings extends GroupSearchField {
  pathMappings?: GroupPathMapping[];
}

@Component({
  standalone: true,
  selector: 'valtimo-group-search-fields',
  templateUrl: './group-search-fields.component.html',
  styleUrl: './group-search-fields.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ButtonModule,
    IconModule,
    TableModule,
    CarbonListModule,
    GroupSearchFieldModalComponent,
    GroupPathMappingEditorComponent,
  ],
})
export class GroupSearchFieldsComponent implements OnInit, OnDestroy {
  protected readonly testIds = CASE_DEFINITION_GROUP_ITEM_LIST_TEST_IDS;

  public readonly searchControl = new FormControl('');

  public readonly fields: ColumnConfig[] = [
    {viewType: ViewType.TEXT, sortable: false, key: 'name', label: 'caseManagement.listColumns.name'},
    {viewType: ViewType.TEXT, sortable: false, key: 'key', label: 'caseManagement.listColumns.key'},
    {
      viewType: ViewType.TEXT,
      sortable: false,
      key: 'dataType',
      label: 'caseManagement.groups.searchFields.dataType',
    },
    {
      viewType: ViewType.TEXT,
      sortable: false,
      key: 'fieldType',
      label: 'caseManagement.groups.searchFields.fieldType',
    },
    {
      viewType: ViewType.TEXT,
      sortable: false,
      key: 'matchType',
      label: 'caseManagement.groups.searchFields.matchType',
    },
  ];

  public readonly actionItems: ActionItem[] = [
    {label: 'interface.edit', callback: this.showEditModal.bind(this)},
    {label: 'interface.delete', callback: this.deleteField.bind(this), type: 'danger'},
  ];

  private readonly _subscriptions = new Subscription();
  private readonly _fields$ = new BehaviorSubject<SearchFieldWithMappings[]>([]);
  private readonly _pathMappingsCache = new Map<string, Observable<GroupPathMapping[]>>();

  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly usedKeys$ = this._fields$.pipe(map(fields => fields.map(f => f.key)));

  private readonly _searchTerm$ = this.searchControl.valueChanges.pipe(
    startWith(''),
    map(search => (search ?? '').trim().toLowerCase())
  );

  // Reordering a filtered subset would drop the hidden rows on save.
  public readonly filtering$ = this._searchTerm$.pipe(map(term => !!term));

  public readonly filteredFields$ = combineLatest([this._fields$, this._searchTerm$]).pipe(
    map(([fields, term]) =>
      fields
        .filter(
          f =>
            !term ||
            f.key.toLowerCase().includes(term) ||
            (f.title && f.title.toLowerCase().includes(term))
        )
        .map(f => ({...f, name: f.title || f.key}))
    )
  );

  public readonly group$ = this.detailService.group$;

  public readonly showModal$ = new BehaviorSubject<boolean>(false);
  public readonly editingField$ = new BehaviorSubject<SearchFieldWithMappings | null>(null);

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
    this._loadGroupAndFields();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public showAddModal(): void {
    this.editingField$.next(null);
    this.showModal$.next(true);
  }

  public showEditModal(field: SearchFieldWithMappings): void {
    this.pathMappings$(field.key)
      .pipe(take(1))
      .subscribe(pathMappings => {
        this.editingField$.next({...this._findField(field.key), pathMappings});
        this.showModal$.next(true);
      });
  }

  public onCloseModal(saved: boolean): void {
    this.showModal$.next(false);
    this.editingField$.next(null);
    if (saved) this._loadFields();
  }

  // Fetched once per field.
  public pathMappings$(fieldKey: string): Observable<GroupPathMapping[]> {
    const groupKey = this.detailService.currentGroup?.key;
    if (!groupKey) return new BehaviorSubject<GroupPathMapping[]>([]);

    if (!this._pathMappingsCache.has(fieldKey)) {
      this._pathMappingsCache.set(
        fieldKey,
        this.groupService
          .getSearchFieldPathMappings(groupKey, fieldKey)
          .pipe(shareReplay({bufferSize: 1, refCount: false}))
      );
    }

    return this._pathMappingsCache.get(fieldKey) as Observable<GroupPathMapping[]>;
  }

  public onItemsReordered(fields: SearchFieldWithMappings[]): void {
    const reordered = fields.map(field => this._findField(field.key));
    this._fields$.next(reordered);
    this._saveFieldOrder(reordered);
  }

  public deleteField(field: GroupSearchField): void {
    const fields = this._fields$.value.filter(f => f.key !== field.key);
    this._fields$.next(fields);
    this._saveFieldOrder(fields);
  }

  private _findField(key: string): SearchFieldWithMappings {
    return this._fields$.value.find(f => f.key === key) as SearchFieldWithMappings;
  }

  private _loadGroupAndFields(): void {
    this._subscriptions.add(
      this.group$
        .pipe(
          filter(group => !!group),
          map(group => group.key),
          distinctUntilChanged()
        )
        .subscribe(() => this._loadFields())
    );
  }

  private _loadFields(): void {
    const groupKey = this.detailService.currentGroup?.key;
    if (!groupKey) return;

    this._pathMappingsCache.clear();

    this.groupService.getSearchFields(groupKey).subscribe(fields => {
      this._fields$.next(fields.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
      this.loading$.next(false);
    });
  }

  private _saveFieldOrder(fields: SearchFieldWithMappings[]): void {
    const groupKey = this.detailService.currentGroup?.key;
    if (!groupKey) return;

    const requests = fields.map(f => ({
      key: f.key,
      title: f.title,
      dataType: f.dataType,
      fieldType: f.fieldType,
      matchType: f.matchType,
      dropdownDataProvider: f.dropdownDataProvider,
    }));

    this.groupService.updateSearchFields(groupKey, requests).subscribe({
      error: () => {
        this.notificationService.showToast({
          type: 'error',
          title: this.translateService.instant('caseManagement.groups.searchFields.saveError'),
        });
      },
    });
  }
}
