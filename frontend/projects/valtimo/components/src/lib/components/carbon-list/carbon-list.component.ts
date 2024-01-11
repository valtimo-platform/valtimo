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
  Component,
  EventEmitter,
  HostBinding,
  Input,
  OnDestroy,
  OnInit,
  Output,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import {FormControl} from '@angular/forms';
import {SettingsView16} from '@carbon/icons';
import {TranslateService} from '@ngx-translate/core';
import {SortState} from '@valtimo/document';
import {
  IconService,
  OverflowMenu,
  PaginationModel,
  PaginationTranslations,
  Table,
  TableHeaderItem,
  TableItem,
  TableModel,
} from 'carbon-components-angular';
import {get as _get} from 'lodash';
import {NGXLogger} from 'ngx-logger';
import {
  BehaviorSubject,
  combineLatest,
  debounceTime,
  map,
  Observable,
  of,
  startWith,
  Subscription,
  switchMap,
  take,
} from 'rxjs';
import {filter} from 'rxjs/operators';
import {
  CarbonListBatchText,
  CarbonListItem,
  CarbonListTranslations,
  CarbonPaginatorConfig,
  ColumnConfig,
  DEFAULT_LIST_TRANSLATIONS,
  DEFAULT_PAGINATION,
  DEFAULT_PAGINATOR_CONFIG,
  Pagination,
  ViewType,
} from '../../models';
import {ViewContentService} from '../view-content/view-content.service';
import {CarbonListFilterPipe} from './CarbonListFilterPipe.directive';

@Component({
  selector: 'valtimo-carbon-list',
  templateUrl: './carbon-list.component.html',
  styleUrls: ['./carbon-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CarbonListFilterPipe],
})
export class CarbonListComponent implements OnInit, AfterViewInit, OnDestroy {
  @HostBinding('attr.data-carbon-theme') theme = 'g10';
  @ViewChild('actionsMenu') actionsMenu: TemplateRef<OverflowMenu>;
  @ViewChild('actionItem') actionItem: TemplateRef<any>;
  @ViewChild('booleanTemplate') booleanTemplate: TemplateRef<any>;
  @ViewChild('rowDisabled') rowDisabled: TemplateRef<any>;

  private _completeDataSource: TableItem[][];
  private _items: CarbonListItem[];
  public items$ = new BehaviorSubject<TableItem[][]>([]);
  @Input() set items(value: CarbonListItem[]) {
    this._items = value;
    if (!this._fields) {
      return;
    }

    this.buildTableItems().subscribe(tableItems => {
      this.model.data = tableItems;
      this._completeDataSource = this.model.data;
    });
  }
  public get items(): CarbonListItem[] {
    return this._items;
  }

  private _fields: ColumnConfig[];
  public fields$: Observable<TableHeaderItem[]> = of([]);
  @Input() set fields(value: ColumnConfig[]) {
    this._fields = value;
    this.buildHeaderItems(value);

    if (!this._items?.length) {
      return;
    }

    this.buildTableItems().subscribe(tableItems => {
      this.model.data = tableItems;
    });
  }

  private _tableTranslations$: BehaviorSubject<CarbonListTranslations> = new BehaviorSubject(
    DEFAULT_LIST_TRANSLATIONS
  );
  @Input() set tableTranslations(value: Partial<CarbonListTranslations>) {
    this._tableTranslations$.next({...DEFAULT_LIST_TRANSLATIONS, ...value});
  }

  @Input() paginatorConfig: CarbonPaginatorConfig = DEFAULT_PAGINATOR_CONFIG;
  private _pagination: Pagination;
  @Input() public set pagination(value: Partial<Pagination>) {
    if (!this._pagination) {
      this._pagination = {...DEFAULT_PAGINATION, ...value};
    }

    this._pagination = {...this._pagination, ...value};
    this.buildPaginationModel();
  }
  public get pagination(): Pagination {
    return this._pagination;
  }

  @Input() loading: boolean;

  /**
   * @deprecated The actions field is deprecated. Actions can be added through the **@Input field**.
   */
  @Input() actions: any[] = [];
  @Input() header: boolean;
  @Input() initialSortState: SortState;
  @Input() isSearchable = false;
  @Input() enableSingleSelection = false;
  /**
   * @deprecated The lastColumnTemplate field is deprecated. Any template column can be added through the **@Input field**.
   */
  @Input() lastColumnTemplate: TemplateRef<any>;
  @Input() paginationIdentifier: string;
  @Input() showSelectionColumn = false;
  @Input() striped = false;
  @Input() hideToolbar = false;
  @Input() lockedTooltipTranslationKey = '';

  @Output() rowClicked = new EventEmitter<any>();
  @Output() paginationClicked = new EventEmitter<number>();
  @Output() paginationSet = new EventEmitter<any>();
  @Output() search = new EventEmitter<any>();
  @Output() sortChanged = new EventEmitter<SortState>();

  public batchText$: Observable<CarbonListBatchText> = this._tableTranslations$.pipe(
    switchMap((translations: CarbonListTranslations) =>
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
      switchMap((translations: CarbonListTranslations) =>
        combineLatest([
          this.translateService.stream(translations.pagination.itemsPerPage),
          this.translateService.stream(translations.pagination.totalItem),
          this.translateService.stream(translations.pagination.totalItems),
          this.translateService.stream('interface.list.ofLastPage'),
          this.translateService.stream('interface.list.ofLastPages'),
        ])
      ),
      map(([ITEMS_PER_PAGE, TOTAL_ITEM, TOTAL_ITEMS, OF_LAST_PAGE, OF_LAST_PAGES]) => ({
        ITEMS_PER_PAGE,
        TOTAL_ITEM,
        TOTAL_ITEMS,
        OF_LAST_PAGE,
        OF_LAST_PAGES,
      }))
    );

  public readonly sort$ = new BehaviorSubject<SortState>({
    state: {name: '', direction: 'DESC'},
    isSorting: false,
  });

  public readonly ViewType = ViewType;
  public model = new TableModel();
  public skeletonModel = Table.skeletonModel(5, 5);
  public paginationModel: PaginationModel;
  public searchFormControl = new FormControl('');
  public viewListAs: string;

  private static readonly PAGINATION_SIZE = 'PaginationSize';
  private readonly _subscriptions = new Subscription();

  public get selectedItems(): CarbonListItem[] {
    return this.model.data.reduce(
      (items: CarbonListItem[], _, index: number) =>
        this.model.isRowSelected(index) ? [...items, this.items[index]] : [...items],
      []
    );
  }

  private readonly _viewInitialized$ = new BehaviorSubject<boolean>(false);

  public get viewInitialized$(): Observable<boolean> {
    return this._viewInitialized$.pipe(filter(initialized => initialized));
  }

  constructor(
    private readonly filterPipe: CarbonListFilterPipe,
    private readonly iconService: IconService,
    private readonly logger: NGXLogger,
    private readonly translateService: TranslateService,
    private readonly viewContentService: ViewContentService
  ) {
    this.viewListAs = localStorage.getItem('viewListAs') || 'table';

    this.iconService.registerAll([SettingsView16]);
  }

  public ngOnInit(): void {
    if (this.pagination) {
      this.loadPaginationSize();
    }

    if (this.initialSortState) {
      this.sort$.next(this.initialSortState);
    }

    this._subscriptions.add(
      this.searchFormControl.valueChanges
        .pipe(debounceTime(500))
        .subscribe((searchString: string | null) => {
          if (this.search.observed) {
            this.search.emit(searchString);
          } else {
            this.model.data = this.filterPipe.transform(
              this._completeDataSource,
              searchString ?? ''
            );
          }
        })
    );
  }

  public ngAfterViewInit(): void {
    this._viewInitialized$.next(true);
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onRowClick(index: number): void {
    const item = this.model.data[index][0]['item'];

    if (!item || item?.locked) {
      return;
    }
    this.rowClicked.emit(item);
  }

  public onSelectPage(page: number): void {
    if (!this.paginationModel.pageLength) {
      return;
    }

    if (this.pagination.size !== this.paginationModel.pageLength) {
      this.setPaginationSize(this.paginationModel.pageLength.toString());
      return;
    }

    this.paginationClicked.emit(page);
  }

  public onSort(headerItem: TableHeaderItem & {key: string}): void {
    const {key, sortable} = headerItem;
    if (!sortable) {
      return;
    }

    this.sort$.pipe(take(1)).subscribe(sort => {
      let newState: SortState;

      if (sort.state.name === key) {
        if (!sort.isSorting) {
          newState = {state: {...sort.state, direction: 'DESC'}, isSorting: true};
        } else {
          if (sort.state.direction === 'DESC') {
            newState = {...sort, state: {...sort.state, direction: 'ASC'}};
          } else {
            newState = {state: {...sort.state, direction: 'DESC'}, isSorting: false};
          }
        }
      } else {
        newState = {state: {name: key, direction: 'DESC'}, isSorting: true};
      }

      this.sort$.next(newState);
      this.sortChanged.emit(newState);
    });
  }

  private buildPaginationModel(): void {
    this.paginationModel = {
      currentPage: this.pagination.page,
      totalDataLength: +this.pagination.collectionSize,
      pageLength: this.pagination.size,
    };
  }

  private buildHeaderItems(fields: ColumnConfig[]): void {
    const translationStreams: Observable<string>[] = fields.map((column: ColumnConfig) =>
      !column.label ? of('') : this.translateService.stream(column.label)
    );

    this._subscriptions.add(
      combineLatest(translationStreams)
        .pipe(
          switchMap((translationResults: string[]) =>
            this.sort$.pipe(map((sortState: SortState) => ({translationResults, sortState})))
          ),
          map(({translationResults, sortState}) => [
            ...translationResults.map(
              (translation: string, index: number) =>
                new TableHeaderItem({
                  data: translation,
                  sortable: !!fields[index].sortable,
                  className: fields[index].className ?? '',
                  key: fields[index].key,
                  sorted: sortState.isSorting && fields[index].key === sortState.state.name,
                  ascending:
                    fields[index].key === sortState.state.name &&
                    sortState.state.direction === 'ASC',
                  viewType: fields[index].viewType,
                })
            ),
          ])
        )
        .subscribe((header: TableHeaderItem[]) => {
          if (!!this.actions.length) {
            header = [
              ...header,
              ...this.actions.map(
                action =>
                  new TableHeaderItem({
                    data: action.columnName,
                    key: action.columnName,
                    ViewType: ViewType.TEMPLATE,
                    sortable: false,
                  })
              ),
            ];
          }

          if (!!this.lastColumnTemplate) {
            header = [
              ...header,
              new TableHeaderItem({
                data: '',
                key: '',
                viewType: ViewType.ACTION,
                sortable: false,
              }),
            ];
          }

          if (this._items?.some(item => item.locked)) {
            header = [
              ...header,
              new TableHeaderItem({
                data: '',
                key: '',
                viewType: ViewType.TEMPLATE,
                sortable: false,
              }),
            ];
          }

          this.model.header = header;
        })
    );
  }

  private buildTableItems(): Observable<TableItem[][]> {
    const itemCount: number = this._items.length;
    const showLocks = this._items?.some(item => item.locked);

    return this.viewInitialized$.pipe(
      take(1),
      map(() =>
        this._items.map((item: CarbonListItem, index: number) => {
          const fields = this._fields.map((column: ColumnConfig) => {
            switch (column.viewType) {
              case ViewType.ACTION:
                return new TableItem({
                  data: {actions: column.actions, item},
                  template: this.actionsMenu,
                });
              case ViewType.TEMPLATE:
                return new TableItem({
                  data: {item, index, length: itemCount},
                  template: column.template,
                });
              case ViewType.BOOLEAN:
                return new TableItem({
                  data: this.resolveObject(column, item) ?? '-',
                  template: this.booleanTemplate,
                });
              default:
                return new TableItem({data: this.resolveObject(column, item) ?? '-', item});
            }
          });

          if (!!this.actions) {
            fields.push(
              ...this.actions.map(
                action =>
                  new TableItem({
                    data: {item, callback: action.callback, iconClass: action.iconClass},
                    template: this.actionItem,
                  })
              )
            );
          }

          if (!!this.lastColumnTemplate) {
            fields.push(
              new TableItem({
                data: {item, index, length: itemCount},
                template: this.lastColumnTemplate,
              })
            );
          }

          if (showLocks) {
            fields.push(
              new TableItem({
                data: {locked: item.locked},
                template: this.rowDisabled,
              })
            );
          }

          return fields;
        })
      )
    );
  }

  private loadPaginationSize(): void {
    const entries = localStorage.getItem(
      `${this.paginationIdentifier}${CarbonListComponent.PAGINATION_SIZE}`
    );
    if (entries !== null) {
      this.pagination = {size: +entries};
      this.paginationSet.emit(+entries);
      this.logger.debug('Pagination loaded from local storage for this list. Current: ', entries);
    } else {
      this.logger.debug(
        'Pagination does NOT exist in local storage for this list. Will use default. Change it to create an entry.'
      );
      this.paginationSet.emit(10);
    }
  }

  private setPaginationSize(numberOfEntries: string): void {
    localStorage.setItem(
      `${this.paginationIdentifier}${CarbonListComponent.PAGINATION_SIZE}`,
      numberOfEntries
    );
    this.logger.debug('Pagination set in local storage for this list: ', numberOfEntries);
    this.paginationSet.emit(numberOfEntries);
  }

  private resolveObject(definition: any, obj: any) {
    const definitionKey = definition.key;
    const customPropString = '$.';
    const key = definitionKey.includes(customPropString)
      ? definitionKey.split(customPropString)[1]
      : definitionKey;
    const resolvedObjValue = _get(obj, key, null);
    return this.viewContentService.get(resolvedObjValue, definition);
  }
}
