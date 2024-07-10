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
import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {DisplayComponent} from '../../../../models';
import {BarChartData, BarChartDisplayTypeProperties} from '../../models';
import {BarChartOptions, type ChartTabularData, ScaleTypes} from '@carbon/charts';
import {CdsThemeService} from '@valtimo/components';
import {BehaviorSubject, filter, map, Observable} from 'rxjs';

@Component({
  selector: 'valtimo-bar-chart-display',
  templateUrl: './bar-chart-display.component.html',
  styleUrls: ['./bar-chart-display.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarChartDisplayComponent implements DisplayComponent {
  @Input() public readonly displayTypeKey: string;
  @Input() public set data(value: BarChartData) {
    if (!value) return;
    this._data$.next(value);
  }
  @Input() public readonly displayTypeProperties: BarChartDisplayTypeProperties;

  private readonly _data$ = new BehaviorSubject<BarChartData | null>(null);

  public readonly barChartData$: Observable<ChartTabularData> = this._data$.pipe(
    filter(data => !!data),
    map(
      data =>
        data?.values.map(dataValue => ({
          group: dataValue.label,
          value: dataValue.value,
        })) || []
    )
  );

  public readonly barChartChartOptions$: Observable<BarChartOptions> =
    this.themeService.currentTheme$.pipe(
      map(currentTheme => ({
        title: 'Vertical simple bar (discrete)',
        theme: currentTheme,
        height: '400px',
        axes: {
          left: {
            mapsTo: 'value',
          },
          bottom: {
            mapsTo: 'group',
            scaleType: ScaleTypes.LABELS,
          },
        },
      }))
    );

  constructor(private readonly themeService: CdsThemeService) {}
}
