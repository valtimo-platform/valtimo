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

import {ComponentFixture, fakeAsync, TestBed, tick} from '@angular/core/testing';
import {TranslateModule} from '@ngx-translate/core';
import {of} from 'rxjs';
import {WIDGET_MANAGEMENT_SERVICE} from '../../../../constants';
import {WidgetTableContent} from '../../../../models';
import {WidgetWizardService} from '../../../../services';
import {WidgetManagementTableComponent} from './widget-management-table.component';

describe('WidgetManagementTableComponent', () => {
  let fixture: ComponentFixture<WidgetManagementTableComponent>;
  let widgetWizardService: WidgetWizardService;

  const content = (): WidgetTableContent =>
    widgetWizardService.$widgetContent() as WidgetTableContent;

  const create = (showFirstColumnOption: boolean, initial: Partial<WidgetTableContent>): void => {
    widgetWizardService.$widgetContent.set({
      collection: 'doc:children',
      defaultPageSize: 5,
      columns: [],
      firstColumnAsTitle: false,
      ...initial,
    } as WidgetTableContent);

    fixture = TestBed.createComponent(WidgetManagementTableComponent);
    fixture.componentInstance.showFirstColumnOption = showFirstColumnOption;
    fixture.detectChanges();
  };

  const setMessage = (noDataMessage: string): void => {
    fixture.componentInstance.form.patchValue({noDataMessage});
    tick(500);
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [WidgetManagementTableComponent, TranslateModule.forRoot()],
      providers: [{provide: WIDGET_MANAGEMENT_SERVICE, useValue: {params$: of({})}}],
    });
    TestBed.overrideComponent(WidgetManagementTableComponent, {set: {template: '', imports: []}});

    widgetWizardService = TestBed.inject(WidgetWizardService);
  });

  it('should save the empty table message', fakeAsync(() => {
    create(true, {});

    setMessage('No children registered');

    expect(content().noDataMessage).toBe('No children registered');
  }));

  it('should start from the saved empty table message when editing', fakeAsync(() => {
    create(true, {noDataMessage: 'No children registered'});

    expect(fixture.componentInstance.form.value.noDataMessage).toBe('No children registered');
  }));

  it('should remove the empty table message when it is cleared', fakeAsync(() => {
    create(true, {noDataMessage: 'No children registered'});

    setMessage('');

    expect('noDataMessage' in content()).toBeFalse();
  }));

  it('should not save an empty table message for the interactive table', fakeAsync(() => {
    create(false, {});

    setMessage('No children registered');

    expect('noDataMessage' in content()).toBeFalse();
  }));
});
