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

import {Injectable} from '@angular/core';
import {Validators} from '@angular/forms';
import {maxDate, minDate} from './validation/date.validators';

@Injectable({
  providedIn: 'root'
})
export class CamundaFormfieldService {

  constructor() {
  }

  public isFormFieldDisabled(formField) {
    return formField.validationConstraints.filter(vc => vc.name === 'readonly').length > 0;
  }

  public getMinDate(formField) {
    return formField.validationConstraints.filter(vc => vc.name === 'minDate' && vc.configuration)[0];
  }

  public getMaxDate(formField) {
    return formField.validationConstraints.filter(vc => vc.name === 'maxDate' && vc.configuration)[0];
  }

  public getValidatorTypes(formField) {
    const validatorTypes = [];
    formField.validationConstraints.forEach(validationConstraint => {
      if (validationConstraint.name === 'required') {
        validatorTypes.push(Validators.required);
      }
      if (validationConstraint.name === 'minlength') {
        validatorTypes.push(Validators.minLength(+validationConstraint.configuration));
      }
      if (validationConstraint.name === 'maxlength') {
        validatorTypes.push(Validators.maxLength(+validationConstraint.configuration));
      }
      if (validationConstraint.name === 'min') {
        validatorTypes.push(Validators.min(+validationConstraint.configuration));
      }
      if (validationConstraint.name === 'max') {
        validatorTypes.push(Validators.max(+validationConstraint.configuration));
      }
      if (validationConstraint.name === 'minDate') {
        validatorTypes.push(minDate(validationConstraint.configuration));
      }
      if (validationConstraint.name === 'maxDate') {
        validatorTypes.push(maxDate(validationConstraint.configuration));
      }
    });
    return validatorTypes;
  }

}
