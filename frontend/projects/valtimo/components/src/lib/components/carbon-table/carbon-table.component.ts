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
import {coerceBooleanProperty} from '@angular/cdk/coercion';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostBinding,
  Input,
  OnDestroy,
  Output,
  TemplateRef,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import {FormControl} from '@angular/forms';
import {TranslateService} from '@ngx-translate/core';
import {
  OverflowMenu,
  PaginationTranslations,
  Table,
  TableHeaderItem,
  TableItem,
  TableModel,
} from 'carbon-components-angular';
import {get as _get} from 'lodash';
import {
  BehaviorSubject,
  combineLatest,
  debounceTime,
  map,
  Observable,
  startWith,
  Subscription,
  switchMap,
} from 'rxjs';
import {
  ActionItem,
  CarbonPaginationSelection,
  CarbonPaginatorConfig,
  CarbonTableBatchText,
  CarbonTableConfig,
  CarbonTableTranslations,
  ColumnConfig,
  DEFAULT_PAGINATOR_CONFIG,
  DEFAULT_TABLE_CONFIG,
  Pagination,
  SortState,
  ViewType,
} from '../../models';
import {ViewContentService} from '../view-content/view-content.service';

@Component({
  selector: 'valtimo-carbon-table',
  templateUrl: './carbon-table.component.html',
  styleUrls: ['./carbon-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class CarbonTableComponent<T> implements AfterViewInit, OnDestroy {
  @HostBinding('attr.data-carbon-theme') public theme = 'g10';

  @ViewChild('actionsMenu', {static: false}) actionsMenu: TemplateRef<OverflowMenu>;

  private _fields: ColumnConfig[];
  @Input() public set fields(value: ColumnConfig[]) {
    if (!value.length) {
      return;
    }

    if (!!this._fields) {
      this._headerItemsSubscription.unsubscribe();
    }

    this._fields = value;
    this._headerItemsSubscription.add(this.getHeaderItems());
  }
  public get fields(): ColumnConfig[] {
    return this._fields;
  }

  @Input() public set pagination(pagination: Pagination) {
    this.setPaginationModel(pagination);
  }
  private _hideTableHeader = false;
  @Input() public get hideTableHeader(): boolean {
    return this._hideTableHeader;
  }
  public set hideTableHeader(value: boolean) {
    this._hideTableHeader = coerceBooleanProperty(value);
  }

  private _hideTableToolbar = false;
  @Input() public get hideTableToolbar(): boolean {
    return this._hideTableToolbar;
  }
  public set hideTableToolbar(value: boolean) {
    this._hideTableToolbar = coerceBooleanProperty(value);
  }

  private _tableData: TableItem[][];
  private _data: Array<T>;
  @Input() set data(value: Array<T>) {
    this._data = value;

    if (!this.fields || !value) {
      return;
    }

    this._tableData = this.getTableItems(value);
    this._tableModel.data = this._tableData;
  }
  public get data(): T[] {
    return this._data;
  }

  @Input() set initialSort(value: SortState) {
    if (!!this._previousSortIndex || !this.fields.length || !value.isSorting) {
      return;
    }

    const fieldIndex: number = this.fields.findIndex(
      (field: ColumnConfig) => field.key === value.state.name
    );

    if (fieldIndex === -1) {
      return;
    }

    const header: TableHeaderItem = this.tableModel.header[fieldIndex];
    this._previousSortIndex = fieldIndex;
    header.sorted = true;
    header.ascending = value.state.direction === 'ASC';
  }

  private _loading = false;
  @Input() public set loading(value: boolean) {
    this._loading = coerceBooleanProperty(value);
  }
  public get loading(): boolean {
    return this._loading;
  }

  private readonly _defaultTranslations: CarbonTableTranslations = {
    select: {single: 'interface.table.singleSelect', multiple: 'interface.table.multipleSelect'},
    pagination: {
      itemsPerPage: 'interface.table.itemsPerPage',
      totalItems: 'interface.table.totalItems',
    },
  };
  private _tableTranslations$: BehaviorSubject<CarbonTableTranslations> = new BehaviorSubject(
    this._defaultTranslations
  );
  @Input() set tableTranslations(value: Partial<CarbonTableTranslations>) {
    this._tableTranslations$.next({...this._defaultTranslations, ...value});
  }

  private _paginatorConfig: CarbonPaginatorConfig = DEFAULT_PAGINATOR_CONFIG;
  @Input() public set paginatorConfig(value: CarbonPaginatorConfig) {
    this._paginatorConfig = {...DEFAULT_PAGINATOR_CONFIG, ...value};
  }
  public get paginatorConfig(): CarbonPaginatorConfig {
    return this._paginatorConfig;
  }

  private _tableConfig: CarbonTableConfig = DEFAULT_TABLE_CONFIG;
  @Input() public set tableConfig(value: CarbonTableConfig) {
    this._tableConfig = {...DEFAULT_TABLE_CONFIG, ...value};
  }
  public get tableConfig(): CarbonTableConfig {
    return this._tableConfig;
  }

  @Output() paginationChange: EventEmitter<CarbonPaginationSelection> = new EventEmitter();
  @Output() rowClick: EventEmitter<T> = new EventEmitter();
  @Output() search: EventEmitter<string | null> = new EventEmitter();
  @Output() sortChange: EventEmitter<SortState> = new EventEmitter();

  public batchText$: Observable<CarbonTableBatchText> = this._tableTranslations$.pipe(
    switchMap((translations: CarbonTableTranslations) =>
      combineLatest([
        this.translateService.stream(translations.select.single),
        this.translateService.stream(translations.select.multiple),
      ]).pipe(
        startWith(
          this.translateService.instant(translations.select.single),
          this.translateService.instant(translations.select.multiple)
        )
      )
    ),
    map(([SINGLE, MULTIPLE]) => ({SINGLE, MULTIPLE}))
  );

  public paginationTranslations$: Observable<Partial<PaginationTranslations>> =
    this._tableTranslations$.pipe(
      switchMap((translations: CarbonTableTranslations) =>
        combineLatest([
          this.translateService.stream(translations.pagination.itemsPerPage),
          this.translateService.stream(translations.pagination.totalItems),
          this.translateService.stream('interface.table.ofLastPage'),
          this.translateService.stream('interface.table.ofLastPages'),
        ])
      ),
      map(([ITEMS_PER_PAGE, TOTAL_ITEMS, OF_LAST_PAGE, OF_LAST_PAGES]) => ({
        ITEMS_PER_PAGE,
        TOTAL_ITEMS,
        OF_LAST_PAGE,
        OF_LAST_PAGES,
      }))
    );

  public searchFormControl = new FormControl('');

  private _headerItemsSubscription = new Subscription();
  private _previousSortIndex: number;
  private _skeletonTableModel: TableModel = Table.skeletonModel(5, 5);
  private _subscriptions = new Subscription();
  private _tableModel = new TableModel();

  public get numberOfColumns(): number | null {
    return this.loading ? null : this.fields.length + (this.tableConfig.enableSingleSelect ? 0 : 1);
  }
  public get tableModel(): TableModel {
    return this.loading ? this._skeletonTableModel : this._tableModel;
  }

  public get selectedItems(): T[] {
    return this._tableModel.data.reduce(
      (items: T[], _, index: number) =>
        this._tableModel.isRowSelected(index) ? [...items, this.data[index]] : [...items],
      []
    );
  }

  constructor(
    private readonly cd: ChangeDetectorRef,
    private readonly viewContentService: ViewContentService,
    private readonly translateService: TranslateService
  ) {}

  public ngAfterViewInit(): void {
    if (this.loading) {
      return;
    }

    this._tableData = this.getTableItems(this.data);
    this._tableModel.data = this._tableData;

    this._subscriptions.add(
      this.searchFormControl.valueChanges
        .pipe(debounceTime(500))
        .subscribe((searchString: string | null) => {
          this.onSearch(searchString);
        })
    );
  }

  public ngOnDestroy(): void {
    this._headerItemsSubscription.unsubscribe();
    this._subscriptions.unsubscribe();
  }

  public onActionItemClick(action: ActionItem, item: T) {
    action.callback(item);
  }

  public onRowClick(rowIndex: number): void {
    if (!this.data[rowIndex]) {
      return;
    }

    this.rowClick.emit(this.data[rowIndex]);
  }

  public onSortClick(index: number): void {
    this.resetSorting(index);
    const header: TableHeaderItem = this.tableModel.header[index];
    const sortState: SortState = {
      state: {name: this.fields[index].key, direction: 'ASC'},
      isSorting: true,
    };

    if (!header.sorted) {
      header.sorted = true;
      header.ascending = true;
      this.sortChange.emit(sortState);
      return;
    }

    if (header.ascending) {
      header.descending = true;
      this.sortChange.emit({...sortState, state: {...sortState.state, direction: 'DESC'}});
      return;
    }

    header.sorted = false;
    this.sortChange.emit({...sortState, isSorting: false});
  }

  public onSelectPage(pageIndex: number): void {
    this.paginationChange.emit({
      page: pageIndex,
      size: this._tableModel.pageLength,
    });
  }

  public trackByIndex(index: number): number {
    return index;
  }

  public getHeaderItems(): Subscription {
    const fields: ColumnConfig[] = this.fields;

    return this.translateService
      .stream(fields.map((field: ColumnConfig) => field.label))
      .subscribe((translations: {[key: string]: string}) => {
        this._tableModel.header = fields.map(
          (field: ColumnConfig, index: number) =>
            new TableHeaderItem({
              data: translations[field.label],
              sortable: field.sortable ?? this.tableConfig.sortable,
              className: field.className ?? '',
              sorted: this.tableModel.header[index]?.sorted ?? false,
              ascending: this.tableModel.header[index]?.ascending ?? false,
            })
        );

        this.cd.detectChanges();
      });
  }

  private onSearch(searchString: string | null): void {
    this.search.emit(searchString);
  }

  private getTableItems(items: T[]): TableItem[][] {
    return !items.length
      ? []
      : items.map((item: T, index: number) =>
          this.fields.map((column: ColumnConfig) => {
            switch (column.viewType) {
              case ViewType.ACTION:
                return new TableItem({
                  data: {actions: column.actions, item},
                  template: this.actionsMenu,
                });
              case ViewType.TEMPLATE:
                return new TableItem({
                  data: {item, index},
                  template: column.template,
                });
              default:
                return new TableItem({data: this.resolveObject(column, item) ?? '-'});
            }
          })
        );
  }

  private resetSorting(index: number): void {
    if (this._previousSortIndex === undefined) {
      this._previousSortIndex = index;
      return;
    }

    if (this._previousSortIndex === index) {
      return;
    }

    this.tableModel.header[this._previousSortIndex].sorted = false;
    this._previousSortIndex = index;
  }

  private resolveObject(column: ColumnConfig, item: T): string {
    const definitionKey = column.key;
    const customPropString = '$.';
    const key = definitionKey.includes(customPropString)
      ? definitionKey.split(customPropString)[1]
      : definitionKey;
    const resolvedObjValue = _get(item, key, null);
    return this.viewContentService.get(resolvedObjValue, column);
  }

  private setPaginationModel(pagination: Pagination): void {
    this._tableModel.totalDataLength = pagination.collectionSize || this.data.length;
    this._tableModel.pageLength = pagination.size;
    this._tableModel.currentPage = pagination.page;
  }
}
