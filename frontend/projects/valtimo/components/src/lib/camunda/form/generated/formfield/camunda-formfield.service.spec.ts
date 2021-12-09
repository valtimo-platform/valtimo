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

import {TestBed} from '@angular/core/testing';
import {CamundaFormfieldService} from './camunda-formfield.service';
import {FormField} from './formfield.model';
import {Validators} from '@angular/forms';
import {maxDate, minDate} from './validation/date.validators';

describe('CamundaFormfieldService', () => {
  let service: CamundaFormfieldService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CamundaFormfieldService);
  });

  function formField(validationConstraints): FormField {
    return {
      businessKey: false,
      defaultValue: 'formfield1',
      id: 'formfield1',
      typeName: 'string',
      label: 'formfield1',
      value: {},
      properties: {},
      validationConstraints: validationConstraints,
    };
  }

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should verify formfield is disabled', () => {
    const validationConstraints = [{
      name: 'readonly',
      configuration: null
    }];
    const disabledFormField = formField(validationConstraints);
    const isFormFieldDisabled = service.isFormFieldDisabled(disabledFormField);

    expect(isFormFieldDisabled).toBeTruthy();
  });

  it('should verify formfield is not disabled', () => {
    const validationConstraints = [{
      name: 'some-thing-else',
      configuration: null
    }];
    const someFormField = formField(validationConstraints);
    const isFormFieldDisabled = service.isFormFieldDisabled(someFormField);

    expect(isFormFieldDisabled).toBeFalsy();
  });

  it('should return minDate validation constraint', () => {
    const configuration = '01-01-2019';
    const validationConstraints = [{
      name: 'minDate',
      configuration: configuration
    }];
    const minDateFormField = formField(validationConstraints);
    const minDateReturned = service.getMinDate(minDateFormField);

    expect(minDateReturned.name).toEqual('minDate');
    expect(minDateReturned.configuration).toEqual(configuration);
  });

  it('should return maxDate validation constraint', () => {
    const configuration = '01-01-2019';
    const validationConstraints = [{
      name: 'maxDate',
      configuration: configuration
    }];
    const maxDateFormField = formField(validationConstraints);
    const maxDateReturned = service.getMaxDate(maxDateFormField);

    expect(maxDateReturned.name).toEqual('maxDate');
    expect(maxDateReturned.configuration).toEqual(configuration);
  });

  it('should return required validator type', () => {
    const validationConstraints = [{
      name: 'required',
      configuration: null
    }];
    const inputFormField = formField(validationConstraints);
    const validatorTypes = service.getValidatorTypes(inputFormField);

    expect(validatorTypes.length).toEqual(1);
    expect(validatorTypes[0]).toEqual(Validators.required);
  });

  it('should return minlength validator type', () => {
    const validationConstraints = [{
      name: 'minlength',
      configuration: 1
    }];
    const inputFormField = formField(validationConstraints);
    const validatorTypes = service.getValidatorTypes(inputFormField);

    expect(validatorTypes.length).toEqual(1);
    expect(validatorTypes[0].toString()).toEqual(Validators.minLength(validationConstraints[0].configuration).toString());
  });

  it('should return maxlength validator type', () => {
    const validationConstraints = [{
      name: 'maxlength',
      configuration: 1
    }];
    const inputFormField = formField(validationConstraints);
    const validatorTypes = service.getValidatorTypes(inputFormField);

    expect(validatorTypes.length).toEqual(1);
    expect(validatorTypes[0].toString()).toEqual(Validators.maxLength(validationConstraints[0].configuration).toString());
  });

  it('should return min validator type', () => {
    const validationConstraints = [{
      name: 'min',
      configuration: 1
    }];
    const inputFormField = formField(validationConstraints);
    const validatorTypes = service.getValidatorTypes(inputFormField);

    expect(validatorTypes.length).toEqual(1);
    expect(validatorTypes[0].toString()).toEqual(Validators.min(validationConstraints[0].configuration).toString());
  });

  it('should return max validator type', () => {
    const validationConstraints = [{
      name: 'max',
      configuration: 1
    }];
    const inputFormField = formField(validationConstraints);
    const validatorTypes = service.getValidatorTypes(inputFormField);

    expect(validatorTypes.length).toEqual(1);
    expect(validatorTypes[0].toString()).toEqual(Validators.max(validationConstraints[0].configuration).toString());
  });

  it('should return minDate validator type', () => {
    const validationConstraints = [{
      name: 'minDate',
      configuration: '01-01-2019'
    }];
    const inputFormField = formField(validationConstraints);
    const validatorTypes = service.getValidatorTypes(inputFormField);

    expect(validatorTypes.length).toEqual(1);
    expect(validatorTypes[0].toString()).toEqual(minDate(validationConstraints[0].configuration).toString());
  });

  it('should return maxDate validator type', () => {
    const validationConstraints = [{
      name: 'maxDate',
      configuration: '01-01-2019'
    }];
    const inputFormField = formField(validationConstraints);
    const validatorTypes = service.getValidatorTypes(inputFormField);

    expect(validatorTypes.length).toEqual(1);
    expect(validatorTypes[0].toString()).toEqual(maxDate(validationConstraints[0].configuration).toString());
  });

});
