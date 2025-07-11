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
import {BehaviorSubject, of, tap} from 'rxjs';
import {
  TableWidget,
  WidgetLayoutService,
  WidgetTableComponent,
  WidgetTableContent,
  WidgetWithUuid,
} from '@valtimo/layout';

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

  private readonly _queryParams$ = new BehaviorSubject<string | null>(null);

  public readonly widgetData$ = of({}).pipe(
    tap(() => this.widgetLayoutService.setWidgetDataLoaded(this.widgetUuid))
  );

  constructor(private readonly widgetLayoutService: WidgetLayoutService) {}

  public onPaginationEvent(event: PaginationModel): void {
    this._queryParams$.next(`page=${event.currentPage - 1}&size=${event.pageLength}`);
  }

  private getPageSizeParam(widgetConfiguration: WidgetWithUuid): string {
    return `size=${(widgetConfiguration.properties as WidgetTableContent).defaultPageSize}`;
  }
}
