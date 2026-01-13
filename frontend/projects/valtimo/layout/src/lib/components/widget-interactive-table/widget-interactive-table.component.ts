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
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  EventEmitter,
  HostBinding,
  Input,
  Output,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import {Link16} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';
import {
  CarbonListItem,
  CarbonListModule,
  CarbonPaginatorConfig,
  ColumnConfig,
  MdiIconViewerComponent,
  Pagination,
  ViewType,
} from '@valtimo/components';
import {CaseDefinition, DocumentService} from '@valtimo/document';
import {Page, SortState} from '@valtimo/shared';
import {
  ButtonModule,
  ContextMenuModule,
  DialogModule,
  IconModule,
  IconService,
  MenuButtonModule,
  PaginationModule,
  SkeletonModule,
  TilesModule,
} from 'carbon-components-angular';
import {BehaviorSubject, Observable} from 'rxjs';
import {FieldsWidgetValue, InteractiveTableWidget, WidgetAction} from '../../models';
import {HttpParams} from '@angular/common/http';

@Component({
  selector: 'valtimo-widget-interactive-table',
  templateUrl: './widget-interactive-table.component.html',
  styleUrls: ['./widget-interactive-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CommonModule,
    CarbonListModule,
    PaginationModule,
    TilesModule,
    TranslateModule,
    ButtonModule,
    DialogModule,
    MenuButtonModule,
    ContextMenuModule,
    IconModule,
    MdiIconViewerComponent,
    SkeletonModule,
  ],
})
export class WidgetInteractiveTableComponent {
  @HostBinding('class') public readonly class = 'valtimo-widget-interactive-table';
  private _widgetConfiguration: InteractiveTableWidget;

  public get widgetConfiguration(): InteractiveTableWidget {
    return this._widgetConfiguration;
  }

  private _sortInitialized = false;
  public readonly $initialSortState = signal<SortState | null>(null);
  @Input({required: true}) public set widgetConfiguration(value: InteractiveTableWidget) {
    this._widgetConfiguration = value;

    this.fields$.next(
      value.properties.columns.map((column: FieldsWidgetValue, index: number) => {
        if (column.sortable && !!column.defaultSort && !this._sortInitialized) {
          this.$initialSortState.set({
            isSorting: true,
            state: {
              direction: column.defaultSort,
              name: `data.${column.key}`,
            },
          });
          this.$sort.set(this.$initialSortState());
          this._sortInitialized = true;
        }

        return {
          key: `data.${column.key}`,
          label: column.title,
          sortable: column.sortable,
          default: column.defaultSort,
          viewType: column.displayProperties?.type ?? ViewType.TEXT,
          ...(!!column.displayProperties?.['format'] && {
            format: column.displayProperties['format'],
          }),
          ...(!!column.displayProperties?.['digitsInfo'] && {
            digitsInfo: column.displayProperties['digitsInfo'],
          }),
          ...(!!column.displayProperties?.['display'] && {
            display: column.displayProperties['display'],
          }),
          ...(!!column.displayProperties?.['currencyCode'] && {
            currencyCode: column.displayProperties['currencyCode'],
          }),
          ...(!!column.displayProperties?.['values'] && {
            values: column.displayProperties['values'],
          }),
        };
      })
    );

    this.cdr.detectChanges();
  }

  public readonly $showPagination = signal<boolean>(false);

  public readonly widgetData$ = new BehaviorSubject<CarbonListItem[] | null>(null);

  private _paginationInitialized = false;

  private _initialNumberOfElements!: number;

  @Input({required: true}) set widgetData(value: any | null) {
    if (!value) {
      this.widgetData$.next(null);
      return;
    }

    this.$showPagination.set(value.totalElements > value.size);

    if (!this._initialNumberOfElements) this._initialNumberOfElements = value.numberOfElements;

    const widgetPage: Page<CarbonListItem> = value['table'] ?? value;
    let widgetData: any[] = value['table']?.content ?? value?.content;

    if (typeof widgetData?.length !== 'number') return;

    if (!value['table']) {
      widgetData = widgetData.map(data => (data['data'] = data));
    }
    if (widgetData.length < this._initialNumberOfElements) {
      const rows = new Array<null>(this._initialNumberOfElements).fill(null);

      widgetData = rows.map((_, index) => widgetData[index] || {...value[0], hidden: true});
    }

    this.widgetData$.next(widgetData);

    if (!this._paginationInitialized) {
      this.$showPagination.set(widgetPage.totalElements > widgetPage.size);

      this.$paginationModel.set(
        widgetPage.totalPages < 0
          ? null
          : {
              page: 1,
              collectionSize: widgetPage.totalElements,
              size: widgetPage.size,
            }
      );

      this._paginationInitialized = true;
    } else {
      this.$paginationModel.update((model: Pagination | null) =>
        !model
          ? null
          : {
              ...model,
              collectionSize: widgetPage.totalElements,
              currentPage: widgetPage.number + 1,
            }
      );
    }

    this.cdr.detectChanges();
  }

  @Output() public readonly paginationEvent = new EventEmitter<Pagination>();
  @Output() public readonly rowClickEvent = new EventEmitter<any>();
  @Output() public readonly actionEvent = new EventEmitter<WidgetAction>();
  @Output() public readonly caseStartEvent = new EventEmitter<CaseDefinition>();
  @Output() public readonly queryParamsEvent = new EventEmitter<HttpParams>();

  public readonly fields$ = new BehaviorSubject<ColumnConfig[]>([]);
  public readonly caseDefinitions$: Observable<CaseDefinition[]> =
    this.documentService.getCaseDefinitions({active: true});

  public readonly $sort = signal<SortState | null>(null);
  public readonly $paginationModel = signal<Pagination | null>(null);
  public readonly $paginatorConfig = signal<CarbonPaginatorConfig>({
    itemsPerPageOptions: [5, 10, 20, 30],
    showPageInput: true,
  });

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly documentService: DocumentService,
    private readonly iconService: IconService
  ) {
    this.iconService.register(Link16);
    effect(() => {
      const paginationModel = this.$paginationModel();
      const sort = this.$sort();
      const paramsObject = {
        ...(!!paginationModel && {
          size: paginationModel.size,
          collectionSize: paginationModel.collectionSize,
          page: paginationModel.page - 1,
        }),
        ...(!!sort &&
          sort.isSorting && {
            sort: `${sort.state.name},${sort.state.direction}`,
          }),
      };
      this.queryParamsEvent.emit(new HttpParams({fromObject: paramsObject}));
    });
  }

  public onActionClick(action: WidgetAction): void {
    this.actionEvent.emit(action);
  }

  public onCaseStart(definition: CaseDefinition): void {
    this.caseStartEvent.emit(definition);
  }

  public onPaginationClicked(page: number): void {
    const paginationModel = this.$paginationModel();
    if (!paginationModel) return;
    this.$paginationModel.set({
      ...paginationModel,
      page,
    });
  }

  public onPaginationSet(size: number): void {
    const paginationModel = this.$paginationModel();
    if (!paginationModel) return;
    this.$paginationModel.set({
      ...paginationModel,
      size,
    });
  }

  public onSortChanged(sortState: SortState): void {
    this.$sort.set(sortState);
  }

  public rowClick(event: any): void {
    this.rowClickEvent.emit(event);
  }
}
