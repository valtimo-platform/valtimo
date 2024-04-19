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
import {type ChartTabularData} from '@carbon/charts';

@Component({
  selector: 'valtimo-gauge-display',
  templateUrl: './gauge-display.component.html',
  styleUrls: ['./gauge-display.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GaugeDisplayComponent implements DisplayComponent {
  @Input() displayTypeKey: string;
  @Input() data: GaugeData;
  @Input() displayTypeProperties: GaugeDisplayTypeProperties;

  public toGaugeData(): ChartTabularData {
    return [
      {
        group: 'value',
        value: this.calculatePercentage(this.data.value, this.data.total), // total = 6
      },
      {
        group: 'delta',
        value: 100.0,
      },
    ];
  }

  public calculatePercentage(value: number, total?: number): number {
    return (value * 100.0) / (total || 100.0);
  }

  public numberFormatter(value: number, total: number): number {
    return Math.round(value * total) / 100.0;
  }

  GaugeChartOptions = {
    resizable: false,
    toolbar: false,
    height: '110px',
    gauge: {
      numberFormatter: value => this.numberFormatter(value, this?.data?.total),
      deltaArrow: {
        enabled: false,
      },
      showPercentageSymbol: false,
      type: 'semi',
    },
  };
}
