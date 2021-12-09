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
import {HttpClientTestingModule} from '@angular/common/http/testing';
import {FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {FormField} from '../formfield.model';
import {Component, Input} from '@angular/core';
import {CamundaChoicefieldFormfieldComponent} from './camunda-choicefield-formfield.component';
import {ChoicefieldService, ChoicefieldValue} from '@valtimo/choicefield';
import {Observable, of} from 'rxjs';

const mockChoiceFieldValueArray: ChoicefieldValue[] = [
  {
    id: 1,
    name: 'Test',
    deprecated: false,
    sortOrder: 1,
    value: 'Test',
    choiceField: {}
  }, {
    id: 2,
    name: 'Test',
    deprecated: true,
    sortOrder: 1,
    value: 'Test',
    choiceField: {}
  }
];

class MockChoicefieldService {
  getChoiceFields() {}
  getChoiceFieldByName(name: string) {}
  getChoiceFieldValuesByName(name: string): Observable<ChoicefieldValue[]> { return of(mockChoiceFieldValueArray); }
  getChoiceFieldValueByNameAndValue(name: string, value: string) {}
  getChoiceFieldValueById(id: number) {}
}

describe('CamundaChoicefieldFormfieldComponent', () => {
  let component: CamundaChoicefieldFormfieldComponent;
  let fixture: ComponentFixture<CamundaChoicefieldFormfieldComponent>;
  let formGroup: FormGroup;

  const mockConfig = { endpointUri: '/api/' };
  const enumValues = {
    'id1': 'value1',
    'id2': 'value2'
  };

  @Component({selector: 'valtimo-camunda-formfield-validation', template: ''})
  class CamundaFormFieldValidationComponent {
    @Input() formField: FormField;
    @Input() formGroup: FormGroup;
  }

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [CamundaFormFieldValidationComponent, CamundaChoicefieldFormfieldComponent],
      imports: [ReactiveFormsModule, FormsModule, HttpClientTestingModule],
      providers: [{provide: ChoicefieldService, useClass: MockChoicefieldService}]
    }).compileComponents();

    fixture = TestBed.createComponent(CamundaChoicefieldFormfieldComponent);
    component = fixture.componentInstance;
  }));

  function getFormField(validationConstraints): FormField {
    return {
      businessKey: false,
      defaultValue: 'formfield1',
      id: 'formfield',
      typeName: 'string',
      label: 'formfield1',
      value: {},
      properties: {},
      type: {
        values: enumValues,
        name: 'ChoiceField'
      },
      validationConstraints: validationConstraints,
    };
  }

  it('should create', () => {
    expect( component ).toBeTruthy();
  });

  it('should create choicefield formfield and exclude deprecated item', () => {
    const formField = getFormField([]);
    formGroup = new FormBuilder().group({});
    formGroup.addControl(formField.id,
      new FormControl(formField.defaultValue, Validators.required)
    );
    component.formField = formField;
    component.formGroup = formGroup;
    fixture.detectChanges();

    component.ngOnInit();
    fixture.detectChanges();

    const el = fixture.debugElement.nativeElement;
    expect(el.querySelector('label').innerText).toEqual(formField.label);
    expect(el.querySelector('select').id).toEqual(formField.id);
    expect(el.querySelector('select')).toBeTruthy();
    expect(el.querySelectorAll('option').length).toEqual(2);
  });
});
