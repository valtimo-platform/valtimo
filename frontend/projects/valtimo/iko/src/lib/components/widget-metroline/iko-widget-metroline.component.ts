/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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
import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {
  MetrolineWidget,
  WidgetDataGroupService,
  WidgetLayoutService,
  WidgetMetrolineComponent,
} from '@valtimo/layout';
import {BehaviorSubject, of, switchMap, tap} from 'rxjs';

@Component({
  selector: 'valtimo-iko-widget-metroline',
  templateUrl: './iko-widget-metroline.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, WidgetMetrolineComponent],
})
export class IkoWidgetMetrolineComponent {
  @Input() public set widgetConfiguration(value: MetrolineWidget) {
    if (!value) return;
    this.widgetConfiguration$.next(value);
  }

  @Input() public readonly widgetUuid: string;

  public readonly widgetConfiguration$ = new BehaviorSubject<MetrolineWidget | null>(null);

  public readonly widgetData$ = this.widgetConfiguration$.pipe(
    switchMap(widgetConfiguration =>
      !widgetConfiguration ? of(null) : this.widgetDataGroupService.dataFor(widgetConfiguration.key)
    ),
    tap(() => this.widgetLayoutService.setWidgetDataLoaded(this.widgetUuid))
  );

  constructor(
    private readonly widgetDataGroupService: WidgetDataGroupService,
    private readonly widgetLayoutService: WidgetLayoutService
  ) {}
}
