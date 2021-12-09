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

import * as momentImported from 'moment';
import {AbstractControl, ValidatorFn} from '@angular/forms';

const moment = momentImported;
moment.locale(localStorage.getItem('langKey'));
const DATE_FORMAT = 'DD-MM-YYYY';

export function minDate(minDateIn: string): ValidatorFn {
  return (control: AbstractControl): { [key: string]: any } | null => {
    if (!control.value) {
      return null;
    }
    const controlDate = moment.utc(control.value).startOf('day');
    const momentMinDate = moment.utc(minDateIn, DATE_FORMAT, true);

    if (!controlDate.isSameOrAfter(momentMinDate)) {
      return {
        minDate: {
          minDate: momentMinDate.format(DATE_FORMAT),
          actual: controlDate.format(DATE_FORMAT)
        }
      };
    } else {
      return null;
    }
  };
}

export function maxDate(maxDateIn: string): ValidatorFn {
  return (control: AbstractControl): { [key: string]: any } | null => {
    if (!control.value) {
      return null;
    }
    const controlDate = moment.utc(control.value).startOf('day');
    const momentMaxDate = moment.utc(maxDateIn, DATE_FORMAT, true);

    if (!controlDate.isSameOrBefore(momentMaxDate)) {
      return {
        maxDate: {
          maxDate: momentMaxDate.format(DATE_FORMAT),
          actual: controlDate.format(DATE_FORMAT)
        }
      };
    } else {
      return null;
    }
  };
}
