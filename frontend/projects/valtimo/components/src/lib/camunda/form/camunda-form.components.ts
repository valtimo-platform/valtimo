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

import {Component, EventEmitter, Input, Output} from '@angular/core';
import {FormField} from './generated/formfield/formfield.model';

@Component({
  selector: 'valtimo-camunda-form',
  templateUrl: './camunda-form.component.html'
})
export class CamundaFormComponent {

  @Input() componentName: string;
  @Input() formFields: FormField[];
  @Output() submitted?: EventEmitter<any> = new EventEmitter();

  constructor() {
  }

  onSubmitted(event) {
    this.submitted.emit(event);
  }

}
