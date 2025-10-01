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
  EventEmitter,
  Input,
  Output,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {
  CarbonListItem,
  CarbonListModule,
  CarbonPaginatorConfig,
  ColumnConfig,
  Pagination,
  ViewType,
} from '@valtimo/components';
import {Page} from '@valtimo/shared';
import {ButtonModule, PaginationModule, TilesModule} from 'carbon-components-angular';
import {BehaviorSubject} from 'rxjs';
import {FieldsWidgetValue, InteractiveTableWidget, WidgetAction} from '../../models';

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
  ],
})
export class WidgetInteractiveTableComponent {
  private _widgetConfiguration: InteractiveTableWidget;

  public get widgetConfiguration(): InteractiveTableWidget {
    return this._widgetConfiguration;
  }

  @Input({required: true}) public set widgetConfiguration(value: InteractiveTableWidget) {
    this._widgetConfiguration = value;

    this.fields$.next(
      value.properties.columns.map((column: FieldsWidgetValue, index: number) => ({
        key: `data.${column.key}`,
        label: column.title,
        viewType: column.displayProperties?.type ?? ViewType.TEXT,
        className: `valtimo-widget-interactive-table--transparent ${index === 0 && value.properties.firstColumnAsTitle ? 'valtimo-widget-interactive-table--title' : ''}`,
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
      }))
    );

    this.cdr.detectChanges();
  }

  public readonly $showPagination = signal<boolean>(false);

  public readonly widgetData$ = new BehaviorSubject<CarbonListItem[] | null>(null);

  private _paginationInitialized = false;

  private _initialNumberOfElements!: number;

  @Input({required: true}) set widgetData(value: any | null) {
    if (!value) return;

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
              collectionSize: Math.ceil(widgetPage.totalElements / widgetPage.size),
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
              currentPage: widgetPage.number + 1,
            }
      );
    }

    this.cdr.detectChanges();
  }

  @Output() public readonly paginationEvent = new EventEmitter<Pagination>();
  @Output() public readonly rowClickEvent = new EventEmitter<any>();
  @Output() public readonly actionEvent = new EventEmitter<WidgetAction>();

  public readonly fields$ = new BehaviorSubject<ColumnConfig[]>([]);

  public readonly $paginationModel = signal<Pagination | null>(null);
  public readonly $paginatorConfig = signal<CarbonPaginatorConfig>({
    itemsPerPageOptions: [5, 10, 20, 30],
    showPageInput: true,
  });

  constructor(private readonly cdr: ChangeDetectorRef) {}

  public onActionClick(action: WidgetAction): void {
    this.actionEvent.emit(action);
  }

  public onPaginationClicked(page: number): void {
    const paginationModel = this.$paginationModel();
    if (!paginationModel) return;
    this.paginationEvent.emit({...paginationModel, page});
  }

  public rowClick(event: any): void {
    this.rowClickEvent.emit(event);
  }
}
