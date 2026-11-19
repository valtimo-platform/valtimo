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

import {CUSTOM_ELEMENTS_SCHEMA} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ChartsModule} from '@carbon/charts-angular';
import {TranslateModule} from '@ngx-translate/core';
import {CdsThemeService} from '@valtimo/components';
import {of} from 'rxjs';
import {BarChartDisplayComponent} from './bar-chart-display.component';

describe('BarChartDisplayComponent', () => {
  const WIDGET_WIDTH = 300;
  const WIDGET_HEIGHT = 424;
  let fixture: ComponentFixture<BarChartDisplayComponent>;
  let container: HTMLDivElement;

  async function waitFor(condition: () => boolean): Promise<void> {
    for (let i = 0; i < 60 && !condition(); i++) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BarChartDisplayComponent],
      imports: [CommonModule, ChartsModule, TranslateModule.forRoot()],
      providers: [{provide: CdsThemeService, useValue: {currentTheme$: of('white')}}],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    container = document.createElement('div');
    container.style.cssText = `position:fixed;top:0;left:0;width:${WIDGET_WIDTH}px;height:${WIDGET_HEIGHT}px;overflow:visible`;
    document.body.appendChild(container);

    fixture = TestBed.createComponent(BarChartDisplayComponent);
    const host = fixture.nativeElement as HTMLElement;
    host.style.display = 'block';
    host.style.height = '100%';
    container.appendChild(host);
  });

  afterEach(() => {
    fixture.destroy();
    container.remove();
  });

  it('keeps the bar chart and its legend inside the widget when there are many categories', async () => {
    fixture.componentRef.setInput('displayTypeProperties', {title: 'Open cases per assignee'});
    fixture.componentRef.setInput('data', {
      values: Array.from({length: 40}, (_, i) => ({
        label: `Assignee number ${i + 1}`,
        value: i + 1,
      })),
    });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    await waitFor(
      () =>
        !!host.querySelector('.cds--cc--legend') && !!host.querySelector('svg.layout-svg-wrapper')
    );

    const limit = container.getBoundingClientRect().bottom;
    const holder = host.querySelector('.cds--chart-holder') as HTMLElement;
    const legend = host.querySelector('.cds--cc--legend') as HTMLElement;
    const graph = host.querySelector('svg.layout-svg-wrapper') as SVGElement;

    expect(holder).toBeTruthy();
    expect(legend).toBeTruthy();
    expect(graph).toBeTruthy();
    expect(holder.getBoundingClientRect().bottom).toBeLessThanOrEqual(limit);
    expect(legend.getBoundingClientRect().bottom).toBeLessThanOrEqual(limit);
    expect(graph.getBoundingClientRect().height).toBeGreaterThan(0);
  });
});
