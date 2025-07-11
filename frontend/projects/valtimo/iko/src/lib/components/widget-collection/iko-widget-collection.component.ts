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

import {ChangeDetectionStrategy, Component, Input, ViewEncapsulation} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
  ButtonModule,
  InputModule,
  PaginationModel,
  PaginationModule,
  TilesModule,
} from 'carbon-components-angular';
import {BehaviorSubject, of, tap} from 'rxjs';
import {CarbonListModule} from '@valtimo/components';
import {TranslateModule} from '@ngx-translate/core';
import {
  CollectionWidget,
  WidgetCollectionComponent,
  WidgetCollectionContent,
  WidgetLayoutService,
  WidgetWithUuid,
} from '@valtimo/layout';

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

  @Input() public readonly widgetUuid: string;

  public readonly widgetConfiguration$ = new BehaviorSubject<CollectionWidget | null>(null);

  private readonly _queryParams$ = new BehaviorSubject<string | null>(null);

  public readonly widgetData$ = of({}).pipe(
    tap(() => this.widgetLayoutService.setWidgetDataLoaded(this.widgetUuid))
  );

  constructor(private readonly widgetLayoutService: WidgetLayoutService) {}

  public onPaginationEvent(event: PaginationModel): void {
    this._queryParams$.next(`page=${event.currentPage - 1}&size=${event.pageLength}`);
  }

  private getPageSizeParam(widgetConfiguration: WidgetWithUuid): string {
    return `size=${(widgetConfiguration.properties as any as WidgetCollectionContent).defaultPageSize}`;
  }
}
