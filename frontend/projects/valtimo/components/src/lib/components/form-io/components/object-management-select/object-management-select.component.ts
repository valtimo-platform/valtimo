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

import {Component, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Subject} from 'rxjs';
import {AccordionModule, ButtonModule, IconModule, IconService} from 'carbon-components-angular';
import {TranslateModule} from '@ngx-translate/core';
import Search16 from '@carbon/icons/es/search/16';
import {CarbonListComponent} from '../../../carbon-list/carbon-list.component';
import {CarbonListModule} from '../../../carbon-list/carbon-list.module';
import {DatePickerModule} from '../../../date-picker/date-picker.module';
import {InputLabelModule} from '../../../input-label/input-label.module';
import {InputModule} from '../../../input/input.module';
import {SelectModule} from '../../../select/select.module';
import {FormioCustomComponent} from '../../../../modules';
import {ColumnConfig, SelectItem, SortState, ViewType} from '../../../../models';
import {
  ColumnFilterConfig,
  ObjectManagementSelectValue,
  ObjectWrapper,
} from './object-management-select.model';
import {ObjectManagementSelectService} from './object-management-select.service';

@Component({
  selector: 'valtimo-object-management-select',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CarbonListModule,
    AccordionModule,
    ButtonModule,
    IconModule,
    TranslateModule,
    InputModule,
    InputLabelModule,
    SelectModule,
    DatePickerModule,
  ],
  templateUrl: './object-management-select.component.html',
  styleUrls: ['./object-management-select.component.scss'],
})
export class ObjectManagementSelectComponent
  implements FormioCustomComponent<ObjectManagementSelectValue[]>, OnInit
{
  @Input() public disabled = false;
  @Input() public label = '';
  @Input() public validate?: {required?: boolean; minLength?: number; maxLength?: number};
  @Input() public valueFormat: 'id' | 'full' | 'columns' = 'id';

  @Output() public valueChange = new EventEmitter<ObjectManagementSelectValue[]>();

  @ViewChild('carbonList') private _carbonList?: CarbonListComponent;
  @ViewChild('selectionList') private _selectionList?: CarbonListComponent;

  public tableFields: ColumnConfig[] = [];
  public tableItems: any[] = [];
  public loading = false;
  public pagination = {page: 1, size: 20, collectionSize: 0};
  public currentSort: {key: string; direction: 'asc' | 'desc'} | null = null;
  public initialSortState: SortState | null = null;

  public filterValues: {[key: string]: any} = {};
  public filterableColumns: ColumnFilterConfig[] = [];
  public filtersExpanded = false;
  public dropdownOptionsMap: {[key: string]: SelectItem[]} = {};

  public clearInputs$ = new Subject<null>();
  public clearSelects$ = new Subject<void>();

  public accumulatedSelections: ObjectManagementSelectValue[] = [];
  public selectionTableItems: any[] = [];
  public selectionSort: {key: string; direction: 'asc' | 'desc'} | null = null;

  private _objectManagementId = '';
  private _objectManagementTitle = '';
  private _columns: ColumnFilterConfig[] = [];
  private _pageSize = 20;
  private _initialized = false;
  private _hydrated = false;
  private _requestSequence = 0;

  private readonly _idSelectionFields: ColumnConfig[] = [
    {key: 'id', label: 'ID', viewType: ViewType.TEXT},
  ];

  constructor(
    private readonly _service: ObjectManagementSelectService,
    private readonly _iconService: IconService
  ) {
    this._iconService.registerAll([Search16]);
  }

  @Input()
  public set objectManagementId(val: string) {
    if (val === this._objectManagementId) {
      return;
    }
    this._objectManagementId = val;
    this._resetConfigState();
    if (val && this._initialized) {
      this._loadData();
    }
  }

  public get objectManagementId(): string {
    return this._objectManagementId;
  }

  @Input()
  public set objectManagementTitle(val: string) {
    if (val === this._objectManagementTitle) {
      return;
    }
    this._objectManagementTitle = val;
    this._resetConfigState();
    if (val && this._initialized && !this._objectManagementId) {
      this._loadData();
    }
  }

  public get objectManagementTitle(): string {
    return this._objectManagementTitle;
  }

  @Input()
  public set columns(val: ColumnFilterConfig[]) {
    this._columns = val || [];
    if (this._initialized) {
      this._initializeColumns();
      if (this._hasConfigIdentifier && this.tableItems.length === 0) {
        this._loadData();
      }
    }
  }

  public get columns(): ColumnFilterConfig[] {
    return this._columns;
  }

  @Input()
  public set pageSize(val: number) {
    this._pageSize = val || 20;
    this.pagination.size = this._pageSize;
  }

  public get pageSize(): number {
    return this._pageSize;
  }

  @Input()
  public set value(val: ObjectManagementSelectValue[]) {
    if (Array.isArray(val)) {
      this.accumulatedSelections = val;
      this._hydrated = true;
      if (this._initialized) {
        this._updateSelectionTableItems();
      }
    }
  }

  public get value(): ObjectManagementSelectValue[] | undefined {
    return this._hydrated ? this.accumulatedSelections : undefined;
  }

  public get canAddMore(): boolean {
    const selectedCount = (this._carbonList?.selectedItems?.filter(i => !i.locked) || []).length;
    if (selectedCount === 0) return false; // Nothing to add
    if (this.validate?.maxLength == null) return true;
    const remainingSlots = this.validate.maxLength - this.accumulatedSelections.length;
    return selectedCount <= remainingSlots;
  }

  public get showFilters(): boolean {
    return this._initialized && this.filterableColumns.length > 0;
  }

  public get selectionFields(): ColumnConfig[] {
    return this.valueFormat === 'id' ? this._idSelectionFields : this.tableFields;
  }

  private get _hasConfigIdentifier(): boolean {
    return !!this._objectManagementId || !!this._objectManagementTitle;
  }

  public ngOnInit(): void {
    this._initialized = true;
    this.pagination.size = this.pageSize;
    this._initializeColumns();
    this._updateSelectionTableItems();
    if (this._hasConfigIdentifier) {
      this._loadData();
    }
  }

  public onSort(event: any): void {
    const columnKey = event?.state?.name;

    if (!columnKey) {
      this.currentSort = null;
    } else if (this.currentSort?.key === columnKey) {
      if (this.currentSort.direction === 'desc') {
        this.currentSort = {key: columnKey, direction: 'asc'};
      } else {
        this.currentSort = null;
      }
    } else {
      this.currentSort = {key: columnKey, direction: 'desc'};
    }
    this.pagination.page = 1;
    this._loadData();
  }

  public onPageChange(page: number): void {
    this.pagination.page = page;
    this._loadData();
  }

  public onPageSizeChange(size: number): void {
    this.pagination.size = size;
    this.pagination.page = 1;
    this._loadData();
  }

  public onSearch(): void {
    this.pagination.page = 1;
    this._loadData();
  }

  public onClearFilters(): void {
    this.filterValues = {};
    this.clearInputs$.next(null);
    this.clearSelects$.next();
    this.pagination.page = 1;
    this._loadData();
  }

  public onAddSelection(): void {
    if (!this._carbonList) return;

    // Filter out locked items (already selected)
    const selected = (this._carbonList.selectedItems || []).filter(item => !item.locked);
    const added: ObjectManagementSelectValue[] = [];

    for (const item of selected) {
      if (
        this.validate?.maxLength != null &&
        this.accumulatedSelections.length + added.length >= this.validate.maxLength
      ) {
        break;
      }
      added.push(this._formatSelectionValue(item));
    }

    if (added.length > 0) {
      this.accumulatedSelections = [...this.accumulatedSelections, ...added];
    }
    this._carbonList.model?.selectAll(false);
    this._updateLockedState();
    this._emitValue();
  }

  public onRemoveSelectedSelections(): void {
    if (!this._selectionList) return;

    const selected = this._selectionList.selectedItems || [];
    const idsToRemove = new Set(selected.map((item: any) => item.id));
    this.accumulatedSelections = this.accumulatedSelections.filter(s => !idsToRemove.has(s.id));
    this._selectionList.model?.selectAll(false);
    this._updateLockedState();
    this._emitValue();
  }

  public onSelectionSort(event: any): void {
    const columnKey = event?.state?.name;

    if (!columnKey) {
      this.selectionSort = null;
    } else if (this.selectionSort?.key === columnKey) {
      if (this.selectionSort.direction === 'desc') {
        this.selectionSort = {key: columnKey, direction: 'asc'};
      } else {
        this.selectionSort = null;
      }
    } else {
      this.selectionSort = {key: columnKey, direction: 'desc'};
    }
    this._updateSelectionTableItems();
  }

  public onClearSelections(): void {
    this.accumulatedSelections = [];
    this._updateLockedState();
    this._emitValue();
  }

  public loadData(): void {
    this._loadData();
  }

  private _loadData(): void {
    if (!this._hasConfigIdentifier) return;

    this.loading = true;
    this._fetchObjects();
  }

  private _resetConfigState(): void {
    this.tableItems = [];
    this.currentSort = null;
    this.initialSortState = null;
    this.pagination = {...this.pagination, page: 1, collectionSize: 0};
  }

  private _fetchObjects(): void {
    const requestSequence = ++this._requestSequence;
    const dataAttrs = this._buildDataAttrsString();
    const sort = this._buildSortString();

    this._service
      .getObjects({
        id: this._objectManagementId || undefined,
        title: !this._objectManagementId ? this._objectManagementTitle : undefined,
        dataAttrs: dataAttrs || undefined,
        page: this.pagination.page - 1,
        size: this.pagination.size,
        sort: sort || undefined,
      })
      .subscribe({
        next: response => {
          if (requestSequence !== this._requestSequence) return;
          this.tableItems = response.content.map(obj => this._mapObjectToRow(obj));
          this.pagination = {
            ...this.pagination,
            collectionSize: response.totalElements,
          };
          this.loading = false;
        },
        error: () => {
          if (requestSequence !== this._requestSequence) return;
          this.loading = false;
        },
      });
  }

  private _initializeColumns(): void {
    this.tableFields = this._columns.map(col => ({
      key: col.path,
      label: col.label,
      sortable: (col.sortable ?? true) && this._isSortableColumn(col.path),
      viewType: this._mapViewType(col.viewType),
    }));

    this.filterableColumns = this._columns.filter(
      col => col.filterable && this._isFilterableColumn(col.path)
    );

    // Apply default sort from first column with defaultSortDirection set
    if (!this.currentSort) {
      const defaultSortCol = this._columns.find(
        col => col.sortable && col.defaultSortDirection && col.defaultSortDirection !== 'none'
      );
      if (defaultSortCol) {
        const direction = defaultSortCol.defaultSortDirection as 'asc' | 'desc';
        this.currentSort = {
          key: defaultSortCol.path,
          direction,
        };
        this.initialSortState = {
          state: {
            name: defaultSortCol.path,
            direction: direction.toUpperCase() as 'ASC' | 'DESC',
          },
          isSorting: true,
        };
      }
    }

    this.dropdownOptionsMap = {};
    for (const col of this.filterableColumns) {
      if (col.inputType === 'dropdown' && col.dropdownOptionsJson) {
        this.dropdownOptionsMap[col.path] = this._parseDropdownOptions(col.dropdownOptionsJson);
      }
      if (!(col.path in this.filterValues)) {
        this.filterValues[col.path] = '';
      }
      if (col.inputType === 'dateRange') {
        if (!(col.path + '_start' in this.filterValues)) {
          this.filterValues[col.path + '_start'] = '';
        }
        if (!(col.path + '_end' in this.filterValues)) {
          this.filterValues[col.path + '_end'] = '';
        }
      }
    }
  }

  private _parseDropdownOptions(json: string): SelectItem[] {
    try {
      const options: {value: string; label: string}[] = JSON.parse(json);
      return options.map(opt => ({id: opt.value, text: opt.label}));
    } catch {
      return [];
    }
  }

  private _mapViewType(type?: string): ViewType {
    switch (type) {
      case 'date':
        return ViewType.DATE;
      case 'boolean':
        return ViewType.BOOLEAN;
      default:
        return ViewType.TEXT;
    }
  }

  private _mapObjectToRow(obj: ObjectWrapper): any {
    const row: any = {_source: obj, id: obj.uuid};
    for (const col of this._columns) {
      row[col.path] = this._getNestedValue(obj, col.path);
    }
    // Mark already-selected items as locked (shows lock icon, filtered out on Add)
    if (this._isAlreadySelected(row)) {
      row.locked = true;
    }
    return row;
  }

  private _getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private _isAlreadySelected(row: any): boolean {
    return this.accumulatedSelections.some(sel => sel.id === row.id);
  }

  private _updateLockedState(): void {
    this.tableItems = this.tableItems.map(row => ({
      ...row,
      locked: this._isAlreadySelected(row),
    }));
  }

  private _buildDataAttrsString(): string | null {
    const filters: string[] = [];

    for (const col of this.filterableColumns) {
      if (!this._isDataColumn(col.path)) continue;

      const dataAttrPath = this._pathToDataAttr(col.path);
      if (col.filterType === 'range' && col.inputType === 'dateRange') {
        const startValue = this._sanitizeFilterValue(this.filterValues[col.path + '_start']);
        const endValue = this._sanitizeFilterValue(this.filterValues[col.path + '_end']);
        if (startValue) {
          filters.push(`${dataAttrPath}__gte__${startValue}`);
        }
        if (endValue) {
          filters.push(`${dataAttrPath}__lte__${endValue}`);
        }
      } else {
        const value = this.filterValues[col.path];
        if (value === undefined || value === null || value === '') continue;
        const sanitized = this._sanitizeFilterValue(value);
        if (!sanitized) continue;
        filters.push(`${dataAttrPath}__${col.filterType || 'icontains'}__${sanitized}`);
      }
    }

    return filters.length > 0 ? filters.join(',') : null;
  }

  private _sanitizeFilterValue(value: any): string {
    if (value === undefined || value === null) return '';
    return String(value).replace(/,/g, '').replace(/__/g, '');
  }

  private _buildSortString(): string | null {
    if (!this.currentSort) return null;

    const col = this._columns.find(c => c.path === this.currentSort!.key);
    if (!col || !this._isSortableColumn(col.path)) return null;

    const direction = this.currentSort.direction === 'asc' ? 'ASC' : 'DESC';
    const orderingPath = col.path.replace(/\./g, '__');
    return `${orderingPath},${direction}`;
  }

  private _isDataColumn(path: string | undefined): boolean {
    return !!path && path.startsWith('record.data.');
  }

  private _isFilterableColumn(path: string | undefined): boolean {
    return this._isDataColumn(path);
  }

  private _isSortableColumn(path: string | undefined): boolean {
    return !!path && path.startsWith('record.');
  }

  private _pathToDataAttr(path: string | undefined): string {
    if (!path || !this._isDataColumn(path)) return '';
    return path.replace('record.data.', '').replace(/\./g, '__');
  }

  private _formatSelectionValue(item: any): ObjectManagementSelectValue {
    const source = item['_source'] as ObjectWrapper;

    switch (this.valueFormat) {
      case 'id':
        return {id: source.uuid};
      case 'full':
        return {id: source.uuid, ...source};
      case 'columns':
      default: {
        const mapped: ObjectManagementSelectValue = {id: source.uuid};
        for (const col of this._columns) {
          this._setNestedValue(mapped, col.path, this._getNestedValue(source, col.path));
        }
        return mapped;
      }
    }
  }

  private _setNestedValue(target: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = target;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (current[key] === null || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    current[keys[keys.length - 1]] = value;
  }

  private _updateSelectionTableItems(): void {
    let items = this.accumulatedSelections.map(sel => {
      const row: any = {_source: sel, id: sel.id};
      for (const col of this._columns) {
        row[col.path] = this._getNestedValue(sel, col.path);
      }
      return row;
    });

    if (this.selectionSort) {
      const {key, direction} = this.selectionSort;
      items = [...items].sort((a, b) => {
        const valA = a[key] ?? '';
        const valB = b[key] ?? '';
        const cmp = String(valA).localeCompare(String(valB));
        return direction === 'asc' ? cmp : -cmp;
      });
    }

    this.selectionTableItems = items;
  }

  private _emitValue(): void {
    this._updateSelectionTableItems();
    this.valueChange.emit(this.accumulatedSelections);
      }
}
