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
import {DonutData, DonutDisplayTypeProperties} from '../../models';
import {type ChartTabularData, DonutChartOptions} from '@carbon/charts';
import {CdsThemeService} from '@valtimo/components';
import {BehaviorSubject, filter, map, Observable} from 'rxjs';

@Component({
  selector: 'valtimo-donut-display',
  templateUrl: './donut-display.component.html',
  styleUrls: ['./donut-display.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DonutDisplayComponent implements DisplayComponent {
  @Input() public readonly displayTypeKey: string;
  @Input() public set data(value: DonutData) {
    if (!value) return;
    this._data$.next(value);
  }
  @Input() public readonly displayTypeProperties: DonutDisplayTypeProperties;

  private readonly _data$ = new BehaviorSubject<DonutData | null>(null);

  public readonly donutData$: Observable<ChartTabularData> = this._data$.pipe(
    filter(data => !!data),
    map(
      data =>
        data?.values.map(dataValue => ({
          group: dataValue.label,
          value: dataValue.value,
        })) || []
    )
  );

  public readonly donutChartOptions$: Observable<DonutChartOptions> =
    this.themeService.currentTheme$.pipe(
      map(currentTheme => ({
        resizable: true,
        toolbar: {enabled: false},
        height: '300px',
        theme: currentTheme,
        donut: {
          alignment: 'center',
          center: {
            label: this.displayTypeProperties.label,
          },
        },
        pie: {
          labels: {
            enabled: false,
          },
        },
        legend: {
          truncation: {
            numCharacter: 28,
          },
        },
      }))
    );

  constructor(private readonly themeService: CdsThemeService) {}
}
