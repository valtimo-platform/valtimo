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

import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {TranslateModule} from '@ngx-translate/core';
import {LoggerTestingModule} from 'ngx-logger/testing';
import {ColumnConfig, ViewType} from '../../models';
import {CarbonListComponent} from './carbon-list.component';
import {CarbonListModule} from './carbon-list.module';

describe('CarbonListComponent failed cell indicator', () => {
  let component: CarbonListComponent;
  let fixture: ComponentFixture<CarbonListComponent>;

  const fields: ColumnConfig[] = [{key: 'name', label: 'Name', viewType: ViewType.TEXT}];

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [CarbonListModule, LoggerTestingModule, TranslateModule.forRoot()],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CarbonListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const buildRow = (item: any): any[] => (component as any).buildRow(fields, item, 0, 1);

  const templatesOf = (row: any[]): unknown[] => row.map(cell => cell.template);

  it('renders the failure template for a cell listed in __failedColumns', () => {
    const row = buildRow({id: '1', name: null, __failedColumns: ['name']});

    const templates = templatesOf(row);

    expect(templates).toContain(component.cellLoadFailedTemplate);
    expect(templates).not.toContain(component.defaultTemplate);
  });

  it('renders the normal cell when the field did not fail', () => {
    const row = buildRow({id: '1', name: 'Case A', __failedColumns: []});

    const templates = templatesOf(row);

    expect(templates).toContain(component.defaultTemplate);
    expect(templates).not.toContain(component.cellLoadFailedTemplate);
  });
});
