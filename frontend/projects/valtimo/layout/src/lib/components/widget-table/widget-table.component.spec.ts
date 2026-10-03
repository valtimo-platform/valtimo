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

import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideNoopAnimations} from '@angular/platform-browser/animations';
import {TranslateModule} from '@ngx-translate/core';
import {LoggerTestingModule} from 'ngx-logger/testing';
import {CarbonListItem} from '@valtimo/components';
import {Page} from '@valtimo/shared';
import {TableWidget, WidgetType} from '../../models';
import {WidgetTableComponent} from './widget-table.component';

describe('WidgetTableComponent', () => {
  let fixture: ComponentFixture<WidgetTableComponent>;

  const widget = (noDataMessage?: string): TableWidget =>
    ({
      type: WidgetType.TABLE,
      key: 'children',
      title: 'Children',
      width: 2,
      highContrast: false,
      displayConditions: [],
      actions: [],
      properties: {
        collection: 'doc:children',
        defaultPageSize: 5,
        firstColumnAsTitle: false,
        columns: [
          {key: 'firstName', title: 'First name', value: 'firstName'},
          {key: 'lastName', title: 'Last name', value: 'lastName'},
        ],
        ...(noDataMessage && {noDataMessage}),
      },
    }) as unknown as TableWidget;

  const page = (content: CarbonListItem[]): Page<CarbonListItem> =>
    ({
      content,
      number: 0,
      size: 5,
      totalElements: content.length,
      totalPages: 1,
      numberOfElements: content.length,
    }) as unknown as Page<CarbonListItem>;

  const render = async (
    configuration: TableWidget,
    data: Page<CarbonListItem>
  ): Promise<HTMLElement> => {
    fixture.componentRef.setInput('widgetConfiguration', configuration);
    fixture.componentRef.setInput('widgetData', data);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return fixture.nativeElement as HTMLElement;
  };

  const headerLabels = (element: HTMLElement): string[] =>
    Array.from(element.querySelectorAll('thead th')).map(
      header => header.textContent?.trim() ?? ''
    );

  const visibleNoResultsText = (element: HTMLElement): string =>
    Array.from(element.querySelectorAll<HTMLElement>('.valtimo-carbon-list__no-results td'))
      .filter(cell => getComputedStyle(cell).display !== 'none')
      .map(cell => cell.textContent?.trim() ?? '')
      .join('');

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [WidgetTableComponent, TranslateModule.forRoot(), LoggerTestingModule],
      providers: [provideNoopAnimations()],
    });

    fixture = TestBed.createComponent(WidgetTableComponent);
  });

  it('should show the column headers when the table has no rows', async () => {
    const element = await render(widget(), page([]));

    expect(headerLabels(element)).toEqual(['First name', 'Last name']);
    expect(element.querySelector('valtimo-no-results')).toBeNull();
  });

  it('should show the configured message when the table has no rows', async () => {
    const element = await render(widget('No children registered'), page([]));

    expect(visibleNoResultsText(element)).toBe('No children registered');
  });

  it('should show the default message when the table has no rows and no message is configured', async () => {
    const element = await render(widget(), page([]));

    expect(visibleNoResultsText(element)).toBe('widgets.noData');
  });

  it('should show the rows when the table has data', async () => {
    const element = await render(
      widget('No children registered'),
      page([{firstName: 'John', lastName: 'Doe'}])
    );

    expect(headerLabels(element)).toEqual(['First name', 'Last name']);
    expect(element.querySelector('tbody')?.textContent).toContain('John');
    expect(element.querySelector('.valtimo-carbon-list__no-results')).toBeNull();
  });
});
