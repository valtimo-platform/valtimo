import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostBinding,
  Input,
  Output,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {OverflowMenu, TableHeaderItem, TableItem, TableModel} from 'carbon-components-angular';
import {
  ActionItem,
  CarbonPaginationConfig,
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
})
export class CarbonTableComponent<T> implements AfterViewInit {
  @HostBinding('class') public class = 'carbon-theme-g10';

  @Input() public tableConfig: CarbonTableConfig;
  @Input() public paginationConfig: CarbonPaginationConfig = createPaginationConfig();

  private _data: Array<T>;
  @Input() public set data(value: Array<T>) {
    this._data = value;

    if (!this.tableConfig) {
      return;
    }

    this.tableModel.data = this.getTableItems(value);
    this.tableData = this.getTableItems(value);

    if (!this.paginationConfig) {
      return;
    }

    this.setPaginationModel();
  }
  public get data(): Array<T> {
    return this._data;
  }

  @Output() public rowClick: EventEmitter<T> = new EventEmitter();
  @Output() public search: EventEmitter<string | null> = new EventEmitter();

  @ViewChild('actionsMenu', {static: false})
  protected actionsMenu: TemplateRef<OverflowMenu>;

  private _tableModel: TableModel = new TableModel();
  public get tableModel(): TableModel {
    return this._tableModel;
  }

  private tableData: Array<Array<TableItem>>;

  public get selectedItems(): Array<T> {
    return this.tableModel.data.reduce(
      (items: Array<T>, _, index: number) =>
        this.tableModel.isRowSelected(index)
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
    this.tableModel.header = this.headerItems;
    this.tableData = this.getTableItems(this.data);

    this.tableModel.data = this.tableData;
    this.setPaginationModel();
    this.cd.detectChanges();
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
    this.tableModel.currentPage = pageIndex;
    this.tableModel.data = this.tableData.slice(
      (pageIndex - 1) * this.tableModel.pageLength,
      pageIndex * this.tableModel.pageLength
    );
  }

  public trackByIndex(index: number): number {
    return index;
  }

  private get headerItems(): Array<TableHeaderItem> {
    return this.tableConfig.fields.map(
      (field: ColumnConfig) =>
        new TableHeaderItem({
          data:
            field.fieldLabel !== undefined
              ? field.fieldLabel
              : this.translateService.instant(field.translationKey ?? ''),
        })
    );
  }

  private getItemInitialIndex(rowIndex: number): number {
    return (this.tableModel.currentPage - 1) * this.tableModel.pageLength + rowIndex;
  }

  private getTableItems(items: Array<T>): Array<Array<TableItem>> {
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
    this.tableModel.totalDataLength = this.data.length;
    this.tableModel.pageLength = !this.paginationConfig.itemsPerPageOptions
      ? 10
      : this.paginationConfig.itemsPerPageOptions[0] ?? 10;
    this.onSelectPage(1);
  }
}
