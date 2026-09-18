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
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {SimpleBarChartComponent} from '@carbon/charts-angular';
import {TranslateModule} from '@ngx-translate/core';
import {CdsThemeService, CurrentCarbonTheme} from '@valtimo/components';
import {of} from 'rxjs';
import {BarChartModule} from '../../bar-chart.module';
import {BarChartData, BarChartDisplayTypeProperties} from '../../models';
import {BarChartDisplayComponent} from './bar-chart-display.component';

describe('BarChartDisplayComponent', () => {
  let component: BarChartDisplayComponent;
  let fixture: ComponentFixture<BarChartDisplayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BarChartModule, TranslateModule.forRoot()],
      providers: [
        {provide: CdsThemeService, useValue: {currentTheme$: of(CurrentCarbonTheme.G10)}},
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BarChartDisplayComponent);
    component = fixture.componentInstance;
    const displayTypeProperties: BarChartDisplayTypeProperties = {
      title: 'Case counts',
      subtitle: '',
    };
    fixture.componentRef.setInput('displayTypeProperties', displayTypeProperties);
  });

  it('renders a chart for the configured counts', () => {
    const data: BarChartData = {
      values: [
        {label: 'Open', value: 4},
        {label: 'In behandeling', value: 11},
        {label: 'Afgerond', value: 2},
      ],
    };
    component.data = data;
    fixture.detectChanges();

    const chart = fixture.debugElement.query(By.directive(SimpleBarChartComponent));

    expect(chart).not.toBeNull();
    expect(chart.nativeElement.querySelector('svg')).not.toBeNull();
  });

  it('renders the no-results message when there are no counts', () => {
    component.data = {values: []};
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.directive(SimpleBarChartComponent))).toBeNull();
    expect(fixture.nativeElement.querySelector('valtimo-no-results')).not.toBeNull();
  });
});
