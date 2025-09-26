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

import {Injectable} from '@angular/core';
import {FormIoStateService} from './form-io-state.service';
import {take} from 'rxjs/operators';

@Injectable()
export class FormIoDomService {
  constructor(private readonly stateService: FormIoStateService) {}

  toggleSubmitButton(disabled: boolean): void {
    this.stateService.currentForm$.pipe(take(1)).subscribe(form => {
      const button = form.formioElement.nativeElement
        .getElementsByClassName('formio-component-submit')[0]
        .getElementsByClassName('btn-primary')[0] as HTMLInputElement;

      button.disabled = disabled;
    });
  }
}
