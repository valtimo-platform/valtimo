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
import {MeterData, MeterDisplayTypeProperties} from '../../models';
import {type ChartTabularData, MeterChartOptions} from '@carbon/charts-angular';
import {CdsThemeService} from '@valtimo/components';
import {BehaviorSubject, combineLatest, filter, map, Observable} from 'rxjs';

@Component({
  selector: 'valtimo-meter-display',
  templateUrl: './meter-display.component.html',
  styleUrls: ['./meter-display.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeterDisplayComponent implements DisplayComponent {
  @Input() public readonly displayTypeKey: string;
  @Input() public set data(value: MeterData) {
    if (!value) return;
    this._data$.next(value);
  }
  @Input() public readonly displayTypeProperties: MeterDisplayTypeProperties;

  private readonly _data$ = new BehaviorSubject<MeterData | null>(null);

  public readonly meterData$: Observable<ChartTabularData> = this._data$.pipe(
    filter(data => !!data),
    map(
      data =>
        data?.values.map(dataValue => ({
          group: dataValue.label,
          value: dataValue.value,
        })) || []
    )
  );

  public readonly meterChartOptions$: Observable<MeterChartOptions> = combineLatest([
    this.themeService.currentTheme$,
    this.meterData$,
  ]).pipe(
    map(([currentTheme, meterData]) => ({
      resizable: true,
      toolbar: {enabled: false},
      theme: currentTheme,
      height: '60px',
      meter: {
        height: 60,
        showLabels: false,
        title: {
          percentageIndicator: {
            enabled: false,
          },
        },
        proportional: {
          total: meterData.reduce((acc, curr) => acc + curr.value, 0),
        },
      },
    }))
  );

  constructor(private readonly themeService: CdsThemeService) {}
}
