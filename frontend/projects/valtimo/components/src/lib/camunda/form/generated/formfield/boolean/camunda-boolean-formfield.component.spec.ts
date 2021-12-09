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
import {CamundaBooleanFormfieldComponent} from './camunda-boolean-formfield.component';
import {FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {FormField} from '../formfield.model';
import {Component, Input} from '@angular/core';

describe('CamundaBooleanFormfieldComponent', () => {
  let component: CamundaBooleanFormfieldComponent;
  let fixture: ComponentFixture<CamundaBooleanFormfieldComponent>;

  let formGroup: FormGroup;

  @Component({selector: 'valtimo-camunda-formfield-validation', template: ''})
  class CamundaFormFieldValidationComponent {
    @Input() formField: FormField;
    @Input() formGroup: FormGroup;
  }

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [CamundaFormFieldValidationComponent, CamundaBooleanFormfieldComponent],
      imports: [ReactiveFormsModule, FormsModule]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CamundaBooleanFormfieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function getFormField(validationConstraints): FormField {
    return {
      businessKey: false,
      defaultValue: 'formfield1',
      id: 'formfield',
      typeName: 'string',
      label: 'formfield1',
      value: {},
      properties: {},
      validationConstraints: validationConstraints,
    };
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should create boolean formfield', () => {
    const formField = getFormField([]);
    formGroup = new FormBuilder().group({});
    formGroup.addControl(formField.id,
      new FormControl(formField.defaultValue, Validators.required)
    );

    component.formField = formField;
    component.formGroup = formGroup;
    fixture.detectChanges();

    const el = fixture.debugElement.nativeElement;
    expect(el.querySelector('label').innerText).toEqual(formField.label);
    expect(el.querySelector('#yes_' + formField.id)).toBeTruthy();
    expect(el.querySelector('#yes_' + formField.id).getAttribute('type')).toEqual('radio');
    expect(el.querySelector('#no_' + formField.id)).toBeTruthy();
    expect(el.querySelector('#no_' + formField.id).getAttribute('type')).toEqual('radio');
  });
});
