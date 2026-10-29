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

import {firstValueFrom, of} from 'rxjs';
import {GaugeChartOptions} from '@carbon/charts-angular';
import {GaugeDisplayComponent} from './gauge-display.component';

describe('GaugeDisplayComponent', () => {
  const themeServiceMock = {currentTheme$: of('g10')};
  const translateServiceMock = {stream: () => of(''), instant: (key: string) => key};

  // Carbon rounds the gauge value to two decimals before calling numberFormatter
  function carbonRounded(value: number): string {
    return Number(value.toFixed(2)) % 1 !== 0 ? value.toFixed(2) : value.toFixed();
  }

  async function displayedNumber(value: number, total: number): Promise<string> {
    const component = new GaugeDisplayComponent(
      themeServiceMock as any,
      translateServiceMock as any
    );
    (component as any).displayTypeProperties = {title: 'Cases', subtitle: '', label: 'cases'};
    component.data = {value, total};

    const chartData = await firstValueFrom(component.chartData$);
    const options: GaugeChartOptions = await firstValueFrom(component.gaugeChartOptions$);
    const percentage = chartData.find(item => item['group'] === 'value')['value'];

    return options.gauge.numberFormatter(carbonRounded(percentage) as any);
  }

  it('shows the value as a whole number when the percentage has many decimals', async () => {
    expect(await displayedNumber(46, 754)).toBe('46');
  });

  it('shows the value when it is a round percentage of the total', async () => {
    expect(await displayedNumber(25, 100)).toBe('25');
  });

  it('shows the total in the delta label', async () => {
    const component = new GaugeDisplayComponent(
      themeServiceMock as any,
      translateServiceMock as any
    );
    (component as any).displayTypeProperties = {title: 'Cases', subtitle: '', label: 'cases'};
    component.data = {value: 46, total: 754};

    const options: GaugeChartOptions = await firstValueFrom(component.gaugeChartOptions$);

    expect(options.gauge.numberFormatter(carbonRounded(-1) as any).trim()).toBe(
      'dashboard.of 754 cases'
    );
  });
});
