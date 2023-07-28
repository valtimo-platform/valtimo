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
import {TranslateService} from '@ngx-translate/core';
import {
  OverflowMenu,
  PaginationTranslations,
  Table,
  TableHeaderItem,
  TableItem,
  TableModel,
} from 'carbon-components-angular';
import {combineLatest, map, Observable, of, startWith, Subscription} from 'rxjs';
import {
  ActionItem,
  CarbonPaginationConfig,
  CarbonPaginationSelection,
  CarbonTableConfig,
  ColumnConfig,
  ColumnType,
  createPaginationConfig,
} from '../../models';

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

  @Input() tableConfig: CarbonTableConfig;
  @Input() paginationConfig: CarbonPaginationConfig = createPaginationConfig();
  @Input() hideTableHeader = false;

  private _tableData: TableItem[][];
  private _data: Array<T>;
  @Input() set data(value: Array<T>) {
    this._data = value;

    if (!this.tableConfig || !value) {
      return;
    }

    this._tableData = this.getTableItems(value);
    this._tableModel.data = this._tableData;

    if (!this.paginationConfig) {
      return;
    }

    this.setPaginationModel();
  }
  public get data(): T[] {
    return this._data;
  }

  @Input() loading = true;

  @Output() paginationChange: EventEmitter<CarbonPaginationSelection> = new EventEmitter();
  @Output() rowClick: EventEmitter<T> = new EventEmitter();
  @Output() search: EventEmitter<string | null> = new EventEmitter();

  public batchText$: Observable<{SINGLE: any; MULTIPLE: any}> = combineLatest([
    this.translateService.stream('interface.table.singleSelect'),
    this.translateService.stream('interface.table.multipleSelect'),
  ]).pipe(
    map(([SINGLE, MULTIPLE]) => ({SINGLE, MULTIPLE})),
    startWith({
      SINGLE: this.translateService.instant('interface.table.singleSelect'),
      MULTIPLE: this.translateService.instant('interface.table.multipleSelect'),
    })
  );

  public paginationTranslations$: Observable<Partial<PaginationTranslations>> = combineLatest([
    this.translateService.stream('interface.table.itemsPerPage'),
    this.translateService.stream('interface.table.ofLastPage'),
    this.translateService.stream('interface.table.ofLastPages'),
    this.translateService.stream('interface.table.totalItems'),
  ]).pipe(
    map(([ITEMS_PER_PAGE, OF_LAST_PAGES, OF_LAST_PAGE, TOTAL_ITEMS]) => ({
      ITEMS_PER_PAGE,
      OF_LAST_PAGES,
      OF_LAST_PAGE,
      TOTAL_ITEMS,
    }))
  );

  private _skeletonTableModel: TableModel = Table.skeletonModel(5, 5);
  private _tableModel: TableModel = new TableModel();
  private _subscriptions$: Subscription = new Subscription();

  public get numberOfColumns(): number | null {
    return this.tableConfig.fields.length + (this.tableConfig.enableSingleSelect ? 0 : 1);
  }
  public get tableModel(): TableModel {
    return this.loading ? this._skeletonTableModel : this._tableModel;
  }

  public get selectedItems(): T[] {
    return this._tableModel.data.reduce(
      (items: T[], _, index: number) =>
        this._tableModel.isRowSelected(index)
          ? [...items, this.data[this.getItemInitialIndex(index)]]
          : [...items],
      []
    );
  }

  constructor(
    private readonly cd: ChangeDetectorRef,
    private readonly translateService: TranslateService
  ) {}

  public ngAfterViewInit(): void {
    this._subscriptions$.add(this.getHeaderItems());

    if (!this.data) {
      return;
    }

    this._tableData = this.getTableItems(this.data);
    this._tableModel.data = this._tableData;

    if (this.tableConfig.withPagination) {
      this.setPaginationModel();
    }

    this.cd.detectChanges();
  }

  public ngOnDestroy(): void {
    this._subscriptions$.unsubscribe();
  }

  public onActionItemClick(action: ActionItem, item: T) {
    action.callback(item);
  }

  public onRowClick(rowIndex: number): void {
    const itemInitialIndex: number = this.getItemInitialIndex(rowIndex);

    if (!this.data[itemInitialIndex]) {
      return;
    }

    this.rowClick.emit(this.data[itemInitialIndex]);
  }

  public onSearch(searchString: string | null): void {
    this.search.emit(searchString);
  }

  public onSelectPage(pageIndex: number): void {
    this._tableModel.currentPage = pageIndex;
    this.paginationChange.emit({
      currentPage: pageIndex,
      pageLength: this._tableModel.pageLength,
    });
  }

  public trackByIndex(index: number): number {
    return index;
  }

  public getHeaderItems(): Subscription {
    const fields: ColumnConfig[] = this.tableConfig.fields;

    const translations = fields.map((field: ColumnConfig) =>
      !field.translationKey ? of('') : this.translateService.stream(field.translationKey)
    );

    return combineLatest(translations).subscribe((translationResults: string[]) => {
      this._tableModel.header = translationResults.map(
        (translation: string, index: number) =>
          new TableHeaderItem({
            data: translation,
            sortable: fields[index].sortable ?? true,
            className: fields[index].className ?? '',
          })
      );
    });
  }

  private getItemInitialIndex(rowIndex: number): number {
    return (this._tableModel.currentPage - 1) * this._tableModel.pageLength + rowIndex;
  }

  private getTableItems(items: T[]): TableItem[][] {
    return !items.length
      ? []
      : items.map((item: T) =>
          this.tableConfig.fields.map((column: ColumnConfig) => {
            switch (column.columnType) {
              case ColumnType.TEXT:
                return new TableItem({data: item[column.fieldName] ?? '-'});
              case ColumnType.ACTION:
                return new TableItem({
                  data: {actions: column.actions, item},
                  template: this.actionsMenu,
                });
              case ColumnType.TEMPLATE:
                return new TableItem({
                  data: item,
                  template: column.template,
                });
              default:
                return new TableItem({data: item[column.fieldName] ?? '-'});
            }
          })
        );
  }

  private setPaginationModel(): void {
    this._tableModel.totalDataLength = this.data.length;
    this._tableModel.pageLength = !this.paginationConfig.itemsPerPageOptions
      ? 10
      : this.paginationConfig.itemsPerPageOptions[0] ?? 10;
    this.onSelectPage(1);
  }
}
