/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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

import {async, ComponentFixture, TestBed} from '@angular/core/testing';

import {ListComponent} from './list.component';

describe('ListComponent', () => {
  let component: ListComponent;
  let fixture: ComponentFixture<ListComponent>;

  const itemTitle = 'Item title';
  const itemFields = [{
    key: 'title',
    label: 'Title'
  }];

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ListComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should create #no-results when no results available', () => {
    component.items = [];
    component.fields = [];
    fixture.detectChanges();

    const el = fixture.debugElement.nativeElement;
    expect(el.querySelectorAll('#no-field-definitions').length).toEqual(0);
    expect(el.querySelectorAll('#no-results').length).toEqual(1);
    expect(el.querySelectorAll('table').length).toEqual(0);
  });

  it('should create #no-field-definitions when no field definitions available', () => {
    component.items = [{
      title: itemTitle
    }];
    component.fields = [];
    fixture.detectChanges();

    const el = fixture.debugElement.nativeElement;
    expect(el.querySelectorAll('#no-field-definitions').length).toEqual(1);
    expect(el.querySelectorAll('#no-results').length).toEqual(0);
    expect(el.querySelectorAll('table').length).toEqual(0);
  });

  it('should create table results when results available', () => {

    component.items = [{
      title: itemTitle
    }];
    component.fields = itemFields;
    fixture.detectChanges();

    const el = fixture.debugElement.nativeElement;
    expect(el.querySelectorAll('#no-field-definitions').length).toEqual(0);
    expect(el.querySelectorAll('#no-results').length).toEqual(0);
    expect(el.querySelectorAll('table').length).toEqual(1);
    expect(el.querySelectorAll('thead tr th')[0].innerText).toEqual(itemFields[0].label);
    expect(el.querySelectorAll('tbody tr td')[0].innerText).toEqual(itemTitle);
  });

});
