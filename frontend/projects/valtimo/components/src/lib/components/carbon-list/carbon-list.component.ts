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
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import {FormControl} from '@angular/forms';
import {ArrowDown16, ArrowUp16, SettingsView16} from '@carbon/icons';
import {TranslateService} from '@ngx-translate/core';
import {InternalCaseStatus, InternalCaseStatusUtils, SortState} from '@valtimo/document';
import {
  IconService,
  OverflowMenu,
  PaginationModel,
  PaginationTranslations,
  Table,
  TableHeaderItem,
  TableItem,
  TableModel,
  TagType,
} from 'carbon-components-angular';
import {get as _get} from 'lodash';
import {NGXLogger} from 'ngx-logger';
import {
  BehaviorSubject,
  combineLatest,
  debounceTime,
  map,
  Observable,
  startWith,
  Subscription,
  switchMap,
  take,
} from 'rxjs';
import {filter, tap} from 'rxjs/operators';
import {BOOLEAN_CONVERTER_VALUES, CASES_WITHOUT_STATUS_KEY} from '../../constants';
import {
  ActionItem,
  CarbonListBatchText,
  CarbonListItem,
  CarbonListTranslations,
  CarbonPaginatorConfig,
  CarbonTag,
  ColumnConfig,
  DEFAULT_LIST_TRANSLATIONS,
  DEFAULT_PAGINATION,
  DEFAULT_PAGINATOR_CONFIG,
  MoveRowDirection,
  MoveRowEvent,
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
  @ViewChild('actionsMenuTemplate') actionsMenuTemplate: TemplateRef<OverflowMenu>;
  @ViewChild('actionTemplate') actionTemplate: TemplateRef<any>;
  @ViewChild('booleanTemplate') booleanTemplate: TemplateRef<any>;
  @ViewChild('moveRowsTemplate') moveRowsTemplate: TemplateRef<any>;
  @ViewChild('rowDisabled') rowDisabled: TemplateRef<any>;
  @ViewChild('tagTemplate') tagTemplate: TemplateRef<any>;
  @ViewChild(Table) private _table: Table;

  private _completeDataSource: TableItem[][];
  private readonly _items$ = new BehaviorSubject<CarbonListItem[]>([]);
  private _items: CarbonListItem[];
  public items$ = new BehaviorSubject<TableItem[][]>([]);
  public currentOpenActionId: string | null = null;

  @Input() set items(value: CarbonListItem[]) {
    this._items = value;
    this._items$.next(value);
  }
  public get items(): CarbonListItem[] {
    return this._items;
  }

  private readonly _fields$ = new BehaviorSubject<ColumnConfig[]>([]);
  @Input() set fields(value: ColumnConfig[]) {
    this._fields$.next(value);
  }

  private _tableTranslations$: BehaviorSubject<CarbonListTranslations> = new BehaviorSubject(
    DEFAULT_LIST_TRANSLATIONS
  );
  @Input() set tableTranslations(value: Partial<CarbonListTranslations>) {
    this._tableTranslations$.next({...DEFAULT_LIST_TRANSLATIONS, ...value});
  }

  @Input() paginatorConfig: CarbonPaginatorConfig = DEFAULT_PAGINATOR_CONFIG;
  private _pagination: Pagination;
  @Input() public set pagination(value: Partial<Pagination> | false) {
    if (!value) {
      return;
    }

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
  @Input() actionItems: ActionItem[];
  @Input() header: boolean;
  @Input() hideColumnHeader: boolean;
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
  @Input() movingRowsEnabled: boolean;

  @Output() rowClicked = new EventEmitter<any>();
  @Output() paginationClicked = new EventEmitter<number>();
  @Output() paginationSet = new EventEmitter<any>();
  @Output() search = new EventEmitter<any>();
  @Output() sortChanged = new EventEmitter<SortState>();
  @Output() moveRow = new EventEmitter<MoveRowEvent>();
  @Output() itemsReordered = new EventEmitter<CarbonListItem[]>();

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
  public readonly tagModalOpen$ = new BehaviorSubject<boolean>(false);
  public readonly tagModalData$ = new BehaviorSubject<CarbonTag[]>([]);

  public readonly CASES_WITHOUT_STATUS_KEY = CASES_WITHOUT_STATUS_KEY;
  public readonly ViewType = ViewType;
  public skeletonModel = Table.skeletonModel(5, 5);
  public paginationModel: PaginationModel;
  public searchFormControl = new FormControl('');

  private static readonly PAGINATION_SIZE = 'PaginationSize';
  private readonly _subscriptions = new Subscription();

  public get selectedItems(): CarbonListItem[] {
    const model = this._table.model;

    return model.data.reduce(
      (items: CarbonListItem[], _, index: number) =>
        model.isRowSelected(index) ? [...items, this.items[index]] : [...items],
      []
    );
  }

  private readonly _viewInitialized$ = new BehaviorSubject<boolean>(false);

  public get viewInitialized$(): Observable<boolean> {
    return this._viewInitialized$.pipe(filter(initialized => initialized));
  }

  public get model(): TableModel {
    return this._table.model;
  }

  constructor(
    private readonly filterPipe: CarbonListFilterPipe,
    private readonly iconService: IconService,
    private readonly logger: NGXLogger,
    private readonly translateService: TranslateService,
    private readonly viewContentService: ViewContentService
  ) {
    this.iconService.registerAll([ArrowDown16, ArrowUp16, SettingsView16]);
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
            return;
          }

          if (!searchString) {
            this._filteredItems$.next(null);
            return;
          }

          this._filteredItems$.next(
            this.filterPipe.transform(this._completeDataSource, searchString ?? '')
          );
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
    const item = this._table.model.data[index][0]['item'];

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

  private _translatedFields$: Observable<ColumnConfig[]> = this.translateService.stream('key').pipe(
    switchMap(() => this._fields$),
    map((fields: ColumnConfig[]) =>
      fields.map((field: ColumnConfig) => ({
        ...field,
        label: !field.label ? '' : this.translateService.instant(field.label),
      }))
    )
  );

  private _headerItems$: Observable<TableHeaderItem[]> = combineLatest([
    this._translatedFields$,
    this.sort$,
  ]).pipe(
    map(([translatedFields, sortState]) =>
      translatedFields.map(
        (field: ColumnConfig) =>
          new TableHeaderItem({
            data: field.label,
            sortable: field.sortable,
            className: field.className,
            key: field.key,
            sorted: sortState.isSorting && field.key === sortState.state.name,
            ascending: field.key === sortState.state.name && sortState.state.direction === 'ASC',
          })
      )
    ),
    map((header: TableHeaderItem[]) => [...header, ...this.extraColumns])
  );

  private readonly _tableItems$: Observable<TableItem[][]> = this._viewInitialized$.pipe(
    switchMap(() => combineLatest([this._fields$, this._items$])),
    filter(([fields, items]) => !!fields && !!items),
    map(([fields, items]) =>
      items.map((item: CarbonListItem, index: number) => [
        ...fields.map((field: ColumnConfig) => {
          switch (field.viewType) {
            case ViewType.TEMPLATE:
              return new TableItem({
                data: {item, index, length: items.length},
                template: field.template,
              });
            case ViewType.BOOLEAN:
              let data = this.resolveObject(field, item);
              data = !BOOLEAN_CONVERTER_VALUES.includes(data)
                ? data
                : `${'viewTypeConverter.' + data}`;
              return new TableItem({
                data,
                template: this.booleanTemplate,
              });
            case ViewType.TAGS:
              return new TableItem({
                data: {tags: item?.tags ?? []},
                template: this.tagTemplate,
              });
            default:
              return new TableItem({data: this.resolveObject(field, item) ?? '-', item});
          }
        }),
        ...this.getExtraItems(item, index, items.length),
      ])
    ),
    tap((data: TableItem[][]) => {
      this._completeDataSource = data;
    })
  );

  private readonly _filteredItems$ = new BehaviorSubject<TableItem[][] | null>(null);

  public readonly model$: Observable<TableModel> = combineLatest([
    this._headerItems$,
    this._tableItems$,
    this._filteredItems$,
  ]).pipe(
    map(([header, data, filteredData]) => {
      const model = new TableModel();
      model.header = header;
      model.data = filteredData ?? data;
      return model;
    }),
    startWith(new TableModel())
  );

  private get extraColumns(): TableHeaderItem[] {
    const emptyHeader = new TableHeaderItem();

    emptyHeader.sortable = false;

    return [
      ...(this.movingRowsEnabled
        ? [
            new TableHeaderItem({
              className: 'valtimo-carbon-list__actions',
              sortable: false,
            }),
          ]
        : []),
      ...(!!this.actions
        ? this.actions.map(
            action =>
              new TableHeaderItem({
                data: action.columnName,
                key: action.columnName,
                sortable: false,
              })
          )
        : []),
      ...(!!this.lastColumnTemplate ? [emptyHeader] : []),
      ...(this._items?.some(item => item.locked) ? [emptyHeader] : []),
      ...(!!this.actionItems
        ? [
            new TableHeaderItem({
              className: 'valtimo-carbon-list__actions',
              sortable: false,
            }),
          ]
        : []),
    ];
  }

  public onMoveDownClick(
    event: Event,
    data: {index: number; item: CarbonListItem; length: number}
  ): void {
    event.stopImmediatePropagation();

    const moveRowEvent = {
      direction: MoveRowDirection.DOWN,
      index: data.index,
    };
    const orderedItems = this.swapItems(this._items, moveRowEvent.index, moveRowEvent.index + 1);

    this.moveRow.emit(moveRowEvent);
    this.itemsReordered.emit(orderedItems);
  }

  public onMoveUpClick(
    event: Event,
    data: {index: number; item: CarbonListItem; length: number}
  ): void {
    event.stopImmediatePropagation();

    const moveRowEvent = {
      direction: MoveRowDirection.UP,
      index: data.index,
    };
    const orderedItems = this.swapItems(this._items, moveRowEvent.index - 1, moveRowEvent.index);

    this.moveRow.emit(moveRowEvent);
    this.itemsReordered.emit(orderedItems);
  }

  public onTagClick(event: Event, tags: CarbonTag[]): void {
    event.stopImmediatePropagation();
    this.tagModalOpen$.next(true);
    this.tagModalData$.next(tags);
  }

  public onCloseEvent(): void {
    this.tagModalOpen$.next(false);
  }

  private getExtraItems(item: CarbonListItem, index: number, length: number): TableItem[] {
    return [
      ...(!!this.actions
        ? this.actions.map(
            action =>
              new TableItem({
                data: {item, callback: action.callback, iconClass: action.iconClass},
                template: this.actionTemplate,
              })
          )
        : []),
      ...(this._items?.some(tableItem => tableItem.locked)
        ? [
            new TableItem({
              data: {locked: item.locked},
              template: this.rowDisabled,
            }),
          ]
        : []),
      ...(!!this.lastColumnTemplate
        ? [new TableItem({data: {item, index, length}, template: this.lastColumnTemplate})]
        : []),
      ...(this.movingRowsEnabled
        ? [
            new TableItem({
              data: {item, index, length},
              template: this.moveRowsTemplate,
            }),
          ]
        : []),
      ...(!!this.actionItems
        ? [
            new TableItem({
              className: 'valtimo-carbon-list__actions',
              data: {actions: this.actionItems, item},
              template: this.actionsMenuTemplate,
            }),
          ]
        : []),
    ];
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

  private swapItems(items: CarbonListItem[], index1: number, index2: number): CarbonListItem[] {
    const temp = [...items];
    temp[index1] = temp.splice(index2, 1, temp[index1])[0];

    return temp;
  }

  public handleActionOpenChange(actionId: string, isOpen: boolean): void {
    if (isOpen) {
      this.currentOpenActionId = actionId;
    } else if (this.currentOpenActionId === actionId) {
      this.currentOpenActionId = null;
    }
  }
}
