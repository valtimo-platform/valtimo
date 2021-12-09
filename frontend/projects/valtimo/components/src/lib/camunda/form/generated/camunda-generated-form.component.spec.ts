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
import {CamundaGeneratedFormComponent} from './camunda-generated-form.component';
import {FormField} from './formfield/formfield.model';
import {FormGroup, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {Directive, Input} from '@angular/core';
import {CamundaFormfieldService} from './formfield/camunda-formfield.service';

describe('CamundaGeneratedFormComponent', () => {
  const formFields: FormField[] = [{
    businessKey: false,
    defaultValue: 'formfield1',
    id: 'formfield1',
    typeName: 'string',
    label: 'formfield1',
    value: {},
    properties: {}
  }, {
    businessKey: false,
    defaultValue: 'formfield2',
    id: 'formfield2',
    typeName: 'string',
    label: 'formfield2',
    value: {},
    properties: {}
  }];

  let component: CamundaGeneratedFormComponent;
  let fixture: ComponentFixture<CamundaGeneratedFormComponent>;
  let camundaFormfieldServicePartial: Partial<CamundaFormfieldService>;
  camundaFormfieldServicePartial = {
    isFormFieldDisabled: function () {
      return false;
    },
    getValidatorTypes: function () {
      return [];
    }
  };

  @Directive({
    selector: '[valtimoCamundaFormfieldGenerator]',
  })
  class CamundaFormfieldGeneratorDirective {
    @Input() formField: FormField;
    @Input() formGroup: FormGroup;
  }

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        FormsModule,
        CommonModule
      ],
      declarations: [
        CamundaGeneratedFormComponent,
        CamundaFormfieldGeneratorDirective
      ],
      providers: [
        {provide: CamundaFormfieldService, useValue: camundaFormfieldServicePartial}
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CamundaGeneratedFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render submit and reset buttons', () => {
    component.formFields = formFields;
    component.ngOnInit();
    fixture.detectChanges();

    const el = fixture.debugElement.nativeElement;
    expect(el.querySelector('#submit-button')).toBeTruthy();
    expect(el.querySelector('#reset-button')).toBeTruthy();
  });
});



