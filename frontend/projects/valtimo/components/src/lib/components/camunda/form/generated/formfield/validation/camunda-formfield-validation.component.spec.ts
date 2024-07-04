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

import {async, ComponentFixture, TestBed} from '@angular/core/testing';
import {CamundaFormfieldValidationComponent} from './camunda-formfield-validation.component';
import {
  UntypedFormBuilder,
  UntypedFormControl,
  UntypedFormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {FormField} from '../formfield.model';
import {maxDate, minDate} from './date.validators';
import moment from 'moment';

moment.locale(localStorage.getItem('langKey'));

describe('CamundaFormfieldValidationComponent', () => {
  const formfieldId = 'formfield1';
  const formField: FormField = {
    businessKey: false,
    defaultValue: 'test',
    id: formfieldId,
    typeName: 'string',
    label: 'My label',
    value: {},
    properties: {},
  };

  let formBuilder: UntypedFormBuilder;
  let formGroup: UntypedFormGroup;

  let component: CamundaFormfieldValidationComponent;
  let fixture: ComponentFixture<CamundaFormfieldValidationComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, FormsModule],
      declarations: [CamundaFormfieldValidationComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CamundaFormfieldValidationComponent);
    component = fixture.componentInstance;
    formBuilder = new UntypedFormBuilder();
    formGroup = formBuilder.group({});
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show required error', () => {
    formGroup.addControl(formfieldId, new UntypedFormControl(null, Validators.required));
    component.formField = formField;
    component.formGroup = formGroup;
    component.ngOnInit();
    fixture.detectChanges();

    const formfield1 = component.formGroup.controls[formfieldId];
    formfield1.setValue('');
    formfield1.markAsTouched();
    fixture.detectChanges();

    const el = fixture.debugElement.nativeElement;
    expect(el.querySelectorAll('li').length).toEqual(1);
    expect(el.querySelector('li').innerText.trim()).toEqual('This field is required.');
  });

  it('should show minlength error', () => {
    const minLength = 5;
    formGroup.addControl(
      formfieldId,
      new UntypedFormControl(null, Validators.minLength(minLength))
    );
    component.formField = formField;
    component.formGroup = formGroup;
    component.ngOnInit();
    fixture.detectChanges();

    const formfield = component.formGroup.controls[formfieldId];
    formfield.setValue('abc');
    formfield.markAsTouched();
    fixture.detectChanges();

    const el = fixture.debugElement.nativeElement;
    expect(el.querySelectorAll('li').length).toEqual(1);
    expect(el.querySelector('li').innerText.trim()).toEqual(
      'This field should be more than ' + minLength + ' characters.'
    );
  });

  it('should show maxlength error', () => {
    const maxLength = 5;
    formGroup.addControl(
      formfieldId,
      new UntypedFormControl(null, Validators.maxLength(maxLength))
    );
    component.formField = formField;
    component.formGroup = formGroup;
    component.ngOnInit();
    fixture.detectChanges();

    const formfield = component.formGroup.controls[formfieldId];
    formfield.setValue('123456');
    formfield.markAsTouched();
    fixture.detectChanges();

    const el = fixture.debugElement.nativeElement;
    expect(el.querySelectorAll('li').length).toEqual(1);
    expect(el.querySelector('li').innerText.trim()).toEqual(
      'This field cannot be more than ' + maxLength + ' characters.'
    );
  });

  it('should show maxlength error', () => {
    const maxLength = 5;
    formGroup.addControl(
      formfieldId,
      new UntypedFormControl(null, Validators.maxLength(maxLength))
    );
    component.formField = formField;
    component.formGroup = formGroup;
    component.ngOnInit();
    fixture.detectChanges();

    const formfield = component.formGroup.controls[formfieldId];
    formfield.setValue('123456');
    formfield.markAsTouched();
    fixture.detectChanges();

    const el = fixture.debugElement.nativeElement;
    expect(el.querySelectorAll('li').length).toEqual(1);
    expect(el.querySelector('li').innerText.trim()).toEqual(
      'This field cannot be more than ' + maxLength + ' characters.'
    );
  });

  it('should show min error', () => {
    const min = 5;
    formGroup.addControl(formfieldId, new UntypedFormControl(null, Validators.min(min)));
    component.formField = formField;
    component.formGroup = formGroup;
    component.ngOnInit();
    fixture.detectChanges();

    const formfield = component.formGroup.controls[formfieldId];
    formfield.setValue(1);
    formfield.markAsTouched();
    fixture.detectChanges();

    const el = fixture.debugElement.nativeElement;
    expect(el.querySelectorAll('li').length).toEqual(1);
    expect(el.querySelector('li').innerText.trim()).toEqual(
      'This field should be more than ' + min + '.'
    );
  });

  it('should show max error', () => {
    const max = 5;
    formGroup.addControl(formfieldId, new UntypedFormControl(null, Validators.max(max)));
    component.formField = formField;
    component.formGroup = formGroup;
    component.ngOnInit();
    fixture.detectChanges();

    const formfield = component.formGroup.controls[formfieldId];
    formfield.setValue(10);
    formfield.markAsTouched();
    fixture.detectChanges();

    const el = fixture.debugElement.nativeElement;
    expect(el.querySelectorAll('li').length).toEqual(1);
    expect(el.querySelector('li').innerText.trim()).toEqual(
      'This field should be less or equal to ' + max + '.'
    );
  });

  it('should show minDate error', () => {
    const minimumDate = moment.utc('01-01-2019', 'DD-MM-YYYY', true);
    formGroup.addControl(
      formfieldId,
      new UntypedFormControl(null, minDate(minimumDate.format('DD-MM-YYYY')))
    );
    component.formField = formField;
    component.formGroup = formGroup;
    component.ngOnInit();
    fixture.detectChanges();

    const inputDate = moment.utc('31-12-2018', 'DD-MM-YYYY', true);

    const formfield = component.formGroup.controls[formfieldId];
    formfield.setValue(inputDate.valueOf());
    formfield.markAsTouched();
    fixture.detectChanges();

    const el = fixture.debugElement.nativeElement;
    expect(el.querySelectorAll('li').length).toEqual(1);
    expect(el.querySelector('li').innerText.trim()).toEqual(
      'This field should be more than ' + minimumDate.format('DD-MM-YYYY') + '.'
    );
  });

  it('should show maxDate error', () => {
    const maximumDate = moment.utc('01-01-2019', 'DD-MM-YYYY', true);
    formGroup.addControl(
      formfieldId,
      new UntypedFormControl(null, maxDate(maximumDate.format('DD-MM-YYYY')))
    );
    component.formField = formField;
    component.formGroup = formGroup;
    component.ngOnInit();
    fixture.detectChanges();

    const inputDate = moment.utc('02-01-2019', 'DD-MM-YYYY', true);

    const formfield = component.formGroup.controls[formfieldId];
    formfield.setValue(inputDate.valueOf());
    formfield.markAsTouched();
    fixture.detectChanges();

    const el = fixture.debugElement.nativeElement;
    expect(el.querySelectorAll('li').length).toEqual(1);
    expect(el.querySelector('li').innerText.trim()).toEqual(
      'This field should be less or equal to ' + maximumDate.format('DD-MM-YYYY') + '.'
    );
  });
});
