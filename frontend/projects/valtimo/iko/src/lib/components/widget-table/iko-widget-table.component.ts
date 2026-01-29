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
import {ChangeDetectionStrategy, Component, Input, ViewEncapsulation} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {CarbonListModule} from '@valtimo/components';
import {
  ButtonModule,
  PaginationModel,
  PaginationModule,
  TilesModule,
} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, distinctUntilChanged, of, switchMap, tap} from 'rxjs';
import {TableWidget, WidgetLayoutService, WidgetTableComponent} from '@valtimo/layout';
import {IkoWidgetParams} from '../../models';
import {IkoApiService} from '../../services';
import { TEST_IDS } from '@valtimo/shared';
import {HttpParams} from '@angular/common/http';

@Component({
  selector: 'valtimo-iko-widget-table',
  templateUrl: './iko-widget-table.component.html',
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
    WidgetTableComponent,
  ],
})
export class IkoWidgetTableComponent {
  readonly TEST_IDS = TEST_IDS;

  private _widgetConfiguration: TableWidget;
  public readonly widgetConfiguration$ = new BehaviorSubject<TableWidget | null>(null);
  @Input({required: true}) public set widgetConfiguration(value: TableWidget) {
    this._widgetConfiguration = value;
    this.widgetConfiguration$.next(value);
  }
  public get widgetConfiguration(): TableWidget {
    return this._widgetConfiguration;
  }

  @Input() public readonly widgetUuid: string;

  private readonly _widgetParams$ = new BehaviorSubject<IkoWidgetParams | null>(null);
  @Input() public set widgetParams(value: IkoWidgetParams) {
    this._widgetParams$.next(value);
  }

  private readonly _queryParams$ = new BehaviorSubject<HttpParams>(new HttpParams());

  public readonly widgetData$ = combineLatest([
    this.widgetConfiguration$,
    this._widgetParams$,
    this._queryParams$.pipe(
      distinctUntilChanged(
        (prevParams, currParams) => prevParams.toString() === currParams.toString()
      )
    ),
  ]).pipe(
    switchMap(([widgetConfiguration, widgetParams, queryParams]) =>
      !widgetParams || !widgetConfiguration
        ? of(null)
        : this.ikoApiService.getIkoWidgetData(
            widgetParams.ikoViewKey,
            widgetParams.tabKey,
            widgetConfiguration.key,
            widgetParams.entryId,
            queryParams
          )
    ),
    tap(() => this.widgetLayoutService.setWidgetDataLoaded(this.widgetUuid))
  );

  constructor(
    private readonly ikoApiService: IkoApiService,
    private readonly widgetLayoutService: WidgetLayoutService
  ) {}

  public onPaginationEvent(event: PaginationModel): void {
    this._queryParams$.next(
      new HttpParams()
        .set('page', (event.currentPage - 1).toString())
        .set('size', event.pageLength.toString())
    );
  }
}
