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
import {GaugeData, GaugeDisplayTypeProperties} from '../../models';
import {type ChartTabularData, GaugeChartOptions} from '@carbon/charts-angular';
import {BehaviorSubject, combineLatest, filter, map, Observable} from 'rxjs';
import {CdsThemeService} from '@valtimo/components';
import {TranslateService} from '@ngx-translate/core';

@Component({
  selector: 'valtimo-gauge-display',
  templateUrl: './gauge-display.component.html',
  styleUrls: ['./gauge-display.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GaugeDisplayComponent implements DisplayComponent {
  @Input() public readonly displayTypeKey: string;
  @Input() public set data(value: GaugeData) {
    if (!value) return;
    this._data$.next(value);
  }
  @Input() public readonly displayTypeProperties: GaugeDisplayTypeProperties;

  private readonly _DELTA: number = -1.0;

  private readonly _data$ = new BehaviorSubject<GaugeData | null>(null);

  public readonly chartData$: Observable<ChartTabularData> = this._data$.pipe(
    filter(data => !!data),
    map(data => [
      {
        group: 'value',
        value: this.calculatePercentage(data?.value || 0, data?.total || 0),
      },
      {
        group: 'delta',
        value: this._DELTA,
      },
    ])
  );

  public readonly gaugeChartOptions$: Observable<GaugeChartOptions> = combineLatest([
    this.themeService.currentTheme$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([currentTheme]) => ({
      resizable: true,
      toolbar: {enabled: false},
      height: '110px',
      theme: currentTheme == 'g10' ? 'white' : 'g100',
      gauge: {
        alignment: 'center',
        numberFormatter: value => this.numberFormatter(this, value),
        deltaArrow: {
          enabled: false,
        },
        showPercentageSymbol: false,
        type: 'semi',
      },
    }))
  );

  constructor(
    private readonly themeService: CdsThemeService,
    private readonly translateService: TranslateService
  ) {}

  private calculatePercentage(value: number, total?: number): number {
    return (value * 100.0) / (total || 100.0);
  }

  private numberFormatter(scope: GaugeDisplayComponent, value: number): string {
    const scopeData = scope._data$.getValue();

    if (value == scope._DELTA) {
      return `${this.translateService.instant('dashboard.of')} ${scopeData?.total || 0} ${scope.displayTypeProperties.label} `;
    }

    return Math.round(value * (scopeData?.total || 0)) / 100.0 + '';
  }
}
