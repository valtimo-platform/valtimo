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
import {DisplayComponent, WidgetSeverity} from '../../../../models';
import {GaugeData, GaugeDisplayTypeProperties} from '../../models';


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

  // public get gaugeData() {
  //   return [
  //     {
  //       group: 'value',
  //       value: 42
  //     },
  //     {
  //       group: 'delta',
  //       value: -13.37
  //     }
  //   ];
  // }
  //
  // public get gaugeOptions(): GaugeChartOptions {
  //   return {
  //     title: 'I work',
  //     resizable: false,
  //     height: '100%',
  //     width: '100%',
  //     gauge: {
  //       type: 'semi',
  //       status: 'danger'
  //     }
  //   };
  // }

  GaugeChartData = [
    {
      group: 'value',
      value: 42
    },
    {
      group: 'delta',
      value: -13.37
    }
  ]

  GaugeChartOptions =
    {
      title: 'I work',
      resizable: false,
      height: '100%',
      width: '100%',
      gauge: {
        type: 'semi',
        status: 'danger'
      }
    };



}
