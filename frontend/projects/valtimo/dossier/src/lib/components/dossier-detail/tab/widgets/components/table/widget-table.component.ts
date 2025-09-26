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
import {CommonModule} from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {CarbonListItem, CarbonListModule, ColumnConfig, ViewType} from '@valtimo/components';
import {Page} from '@valtimo/config';
import {PaginationModel, PaginationModule, TilesModule} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, filter, map, Observable, of, switchMap} from 'rxjs';
import {FieldsCaseWidgetValue, TableCaseWidget} from '../../../../../../models';
import {DossierWidgetsApiService} from '../../../../../../services';

@Component({
  selector: 'valtimo-widget-table',
  templateUrl: './widget-table.component.html',
  styleUrls: ['./widget-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [CommonModule, CarbonListModule, PaginationModule, TilesModule, TranslateModule],
})
export class WidgetTableComponent {
  @Input({required: true}) public documentId: string;
  @Input({required: true}) public tabKey: string;

  private _widgetConfiguration: TableCaseWidget;
  @Input({required: true}) public set widgetConfiguration(value: TableCaseWidget) {
    this._widgetConfiguration = value;
    this.fields$.next(
      value.properties.columns.map((column: FieldsCaseWidgetValue, index: number) => ({
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
  public get widgetConfiguration(): TableCaseWidget {
    return this._widgetConfiguration;
  }

  private readonly _initialNumberOfElementsSubject$ = new BehaviorSubject<number>(null);

  private get _initialNumberOfElements$(): Observable<number> {
    return this._initialNumberOfElementsSubject$.pipe(
      filter(numberOfElements => numberOfElements !== null)
    );
  }

  public readonly showPagination$ = new BehaviorSubject<boolean>(false);

  private _widgetData$ = new BehaviorSubject<CarbonListItem[] | null>(null);
  @Input({required: true}) set widgetData(value: Page<CarbonListItem> | null) {
    if (!value) return;

    this.showPagination$.next(value.totalElements > value.size);
    this._initialNumberOfElementsSubject$.next(value.numberOfElements);
    this._widgetData$.next(value.content);

    this.paginationModel.set(
      value.totalPages < 2
        ? null
        : {
            currentPage: 1,
            totalDataLength: Math.ceil(value.totalElements / value.size),
            pageLength: value.size,
          }
    );
    this.cdr.detectChanges();
  }

  public readonly fields$ = new BehaviorSubject<ColumnConfig[]>([]);
  private readonly _queryParams$ = new BehaviorSubject<string | null>(null);

  public readonly paginationModel = signal<PaginationModel>(new PaginationModel());

  public readonly widgetData$ = combineLatest([
    this._widgetData$,
    this._queryParams$,
    this._initialNumberOfElements$,
  ]).pipe(
    switchMap(([data, queryParams, initialNumberOfElements]) =>
      combineLatest([
        !queryParams
          ? of(data)
          : this.dossierWidgetsApiService
              .getWidgetData(
                this.documentId,
                this.tabKey,
                this.widgetConfiguration.key,
                queryParams
              )
              .pipe(map((res: Page<CarbonListItem>) => res.content)),
        of(initialNumberOfElements),
      ])
    ),
    filter(([items]) => !!items),
    map(([items, initialNumberOfElements]) => {
      if (items.length === initialNumberOfElements) {
        return items;
      }

      const rows = new Array<number>(initialNumberOfElements).fill(null);

      return rows.map((_, index) => items[index] || {});
    })
  );

  constructor(
    private readonly dossierWidgetsApiService: DossierWidgetsApiService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  public onSelectPage(page: number): void {
    this._queryParams$.next(`page=${page - 1}&size=${this.paginationModel().pageLength}`);
    this.paginationModel.update((model: PaginationModel) => ({
      ...model,
      currentPage: page,
    }));
  }
}
