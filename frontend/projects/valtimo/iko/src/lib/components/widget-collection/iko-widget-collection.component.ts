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
import {CollectionWidget, WidgetCollectionComponent, WidgetLayoutService} from '@valtimo/layout';
import {
  ButtonModule,
  InputModule,
  PaginationModel,
  PaginationModule,
  TilesModule,
} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, of, switchMap, tap} from 'rxjs';
import {IkoWidgetParams} from '../../models';
import {IkoApiService} from '../../services';

@Component({
  selector: 'valtimo-iko-widget-collection',
  templateUrl: './iko-widget-collection.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CommonModule,
    InputModule,
    PaginationModule,
    TilesModule,
    CarbonListModule,
    TranslateModule,
    ButtonModule,
    WidgetCollectionComponent,
  ],
})
export class IkoWidgetCollectionComponent {
  @Input() public set widgetConfiguration(value: CollectionWidget) {
    if (!value) return;
    this.widgetConfiguration$.next(value);
  }

  private readonly _widgetParams$ = new BehaviorSubject<IkoWidgetParams | null>(null);
  @Input() public set widgetParams(value: IkoWidgetParams) {
    this._widgetParams$.next(value);
  }

  @Input() public readonly widgetUuid: string;

  public readonly widgetConfiguration$ = new BehaviorSubject<CollectionWidget | null>(null);

  private readonly _queryParams$ = new BehaviorSubject<string | null>(null);

  public readonly widgetData$ = combineLatest([
    this.widgetConfiguration$,
    this._widgetParams$,
  ]).pipe(
    switchMap(([widgetConfiguration, widgetParams]) =>
      !widgetParams || !widgetConfiguration
        ? of(null)
        : this.ikoApiService.getIkoWidgetData(
            widgetParams.dataAggregateKey,
            widgetParams.tabKey,
            widgetConfiguration.key,
            widgetParams.entryId
          )
    ),
    tap(() => this.widgetLayoutService.setWidgetDataLoaded(this.widgetUuid))
  );

  constructor(
    private readonly ikoApiService: IkoApiService,
    private readonly widgetLayoutService: WidgetLayoutService
  ) {}

  public onPaginationEvent(event: PaginationModel): void {
    this._queryParams$.next(`page=${event.currentPage - 1}&size=${event.pageLength}`);
  }
}
