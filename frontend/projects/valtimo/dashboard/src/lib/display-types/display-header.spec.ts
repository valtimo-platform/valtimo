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
import {NO_ERRORS_SCHEMA, Pipe, PipeTransform, Type} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {TranslateService} from '@ngx-translate/core';
import {CdsThemeService} from '@valtimo/components';
import {of} from 'rxjs';
import {BarChartDisplayComponent} from './bar-chart/components/bar-chart-display/bar-chart-display.component';
import {BigNumberDisplayComponent} from './big-number/components/big-number-display/big-number-display.component';
import {DonutDisplayComponent} from './donut/components/donut-display/donut-display.component';
import {GaugeDisplayComponent} from './gauge/components/gauge-display/gauge-display.component';
import {MeterDisplayComponent} from './meter/components/meter-display/meter-display.component';

@Pipe({name: 'translate', standalone: false})
class TranslatePipeStub implements PipeTransform {
  public transform(value: string): string {
    return value;
  }
}

const LONG_TITLE = 'Number of open objection cases per department this quarter';
const LONG_SUBTITLE = 'Only cases that were received through the online objection form';

const DISPLAY_COMPONENTS: {name: string; component: Type<any>; prefix: string}[] = [
  {name: 'bar chart', component: BarChartDisplayComponent, prefix: 'valtimo-donut-widget'},
  {name: 'big number', component: BigNumberDisplayComponent, prefix: 'valtimo-big-number-widget'},
  {name: 'donut', component: DonutDisplayComponent, prefix: 'valtimo-donut-widget'},
  {name: 'gauge', component: GaugeDisplayComponent, prefix: 'valtimo-gauge-widget'},
  {name: 'meter', component: MeterDisplayComponent, prefix: 'valtimo-donut-widget'},
];

describe('Dashboard widget header', () => {
  DISPLAY_COMPONENTS.forEach(({name, component, prefix}) => {
    describe(`${name} widget`, () => {
      let fixture: ComponentFixture<any>;
      let host: HTMLElement;

      beforeEach(async () => {
        await TestBed.configureTestingModule({
          imports: [CommonModule],
          declarations: [component, TranslatePipeStub],
          providers: [
            {provide: CdsThemeService, useValue: {currentTheme$: of('g10')}},
            {
              provide: TranslateService,
              useValue: {stream: () => of(''), instant: (k: string) => k},
            },
          ],
          schemas: [NO_ERRORS_SCHEMA],
        }).compileComponents();

        fixture = TestBed.createComponent(component);
        (fixture.componentInstance as any).displayTypeProperties = {
          title: LONG_TITLE,
          subtitle: LONG_SUBTITLE,
          label: 'cases',
        };
        host = fixture.nativeElement;
        host.style.display = 'flex';
        host.style.width = '200px';
        // Carbon's reset sets body line-height to 1
        host.style.lineHeight = '1';
        fixture.detectChanges();
      });

      afterEach(() => fixture.destroy());

      it('keeps a long subtitle inside the widget', () => {
        const subtitle: HTMLElement = host.querySelector(`.${prefix}__subtitle`);

        expect(subtitle.getBoundingClientRect().right).toBeLessThanOrEqual(
          host.getBoundingClientRect().right
        );
      });

      it('does not cut off the bottom of the subtitle letters', () => {
        const subtitle: HTMLElement = host.querySelector(`.${prefix}__subtitle`);

        expect(subtitle.scrollHeight).toBeLessThanOrEqual(subtitle.clientHeight);
      });

      it('shows the full title and subtitle on hover', () => {
        expect(host.querySelector(`.${prefix}__title`).getAttribute('title')).toBe(LONG_TITLE);
        expect(host.querySelector(`.${prefix}__subtitle`).getAttribute('title')).toBe(
          LONG_SUBTITLE
        );
      });
    });
  });
});
