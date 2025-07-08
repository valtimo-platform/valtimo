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
import {CarbonListItem, CarbonListModule, ColumnConfig, ViewType} from '@valtimo/components';
import {Page} from '@valtimo/shared';
import {
  ButtonModule,
  PaginationModel,
  PaginationModule,
  TilesModule,
} from 'carbon-components-angular';
import {BehaviorSubject} from 'rxjs';
import {FieldsWidgetValue, TableWidget} from '../../models';

@Component({
  selector: 'valtimo-widget-table',
  templateUrl: './widget-table.component.html',
  styleUrls: ['./widget-table.component.scss'],
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
export class WidgetTableComponent {
  private _widgetConfiguration: TableWidget;

  public get widgetConfiguration(): TableWidget {
    return this._widgetConfiguration;
  }

  @Input({required: true}) public set widgetConfiguration(value: TableWidget) {
    this._widgetConfiguration = value;

    this.fields$.next(
      value.properties.columns.map((column: FieldsWidgetValue, index: number) => ({
        key: column.key,
        label: column.title,
        viewType: column.displayProperties?.type ?? ViewType.TEXT,
        className: `valtimo-widget-table--transparent ${index === 0 && value.properties.firstColumnAsTitle ? 'valtimo-widget-table--title' : ''}`,
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

  public readonly showPagination$ = new BehaviorSubject<boolean>(false);

  public readonly widgetData$ = new BehaviorSubject<CarbonListItem[] | null>(null);

  private _paginationInitialized = false;

  private _initialNumberOfElements!: number;

  @Input({required: true}) set widgetData(value: Page<CarbonListItem> | null) {
    if (!value) return;

    this.showPagination$.next(value.totalElements > value.size);

    if (!this._initialNumberOfElements) this._initialNumberOfElements = value.numberOfElements;

    let widgetData: CarbonListItem[] = value.content;

    if (value.content.length < this._initialNumberOfElements) {
      const rows = new Array<number>(this._initialNumberOfElements).fill(null);

      widgetData = rows.map((_, index) => value.content[index] || {...value[0], hidden: true});
    }

    this.widgetData$.next(widgetData);

    if (!this._paginationInitialized) {
      this.showPagination$.next(value.totalElements > value.size);

      this.paginationModel.set(
        value.totalPages < 0
          ? null
          : {
              currentPage: 1,
              totalDataLength: Math.ceil(value.totalElements / value.size),
              pageLength: value.size,
            }
      );

      this._paginationInitialized = true;
    } else {
      this.paginationModel.update((model: PaginationModel) => ({
        ...model,
        currentPage: value.number + 1,
      }));
    }

    this.cdr.detectChanges();
  }

  @Output() public readonly paginationEvent = new EventEmitter<PaginationModel>();

  public readonly fields$ = new BehaviorSubject<ColumnConfig[]>([]);

  public readonly paginationModel = signal<PaginationModel>(new PaginationModel());

  constructor(private readonly cdr: ChangeDetectorRef) {}

  public onSelectPage(page: number): void {
    this.paginationEvent.emit({...this.paginationModel(), currentPage: page});
  }
}
