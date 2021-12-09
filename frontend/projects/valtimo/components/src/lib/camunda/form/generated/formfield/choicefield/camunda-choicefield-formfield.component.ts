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

import {Component, OnInit} from '@angular/core';
import {FormGroup} from '@angular/forms';
import {FormField} from '../formfield.model';
import {ChoicefieldService} from '@valtimo/choicefield';

@Component({
  selector: 'valtimo-camunda-choicefield-formfield',
  templateUrl: './camunda-choicefield-formfield.component.html'
})

export class CamundaChoicefieldFormfieldComponent implements OnInit {

  public formGroup: FormGroup;
  public formField: FormField;
  public choicefieldValues: Array<any> = [];

  constructor(private choicefieldService: ChoicefieldService) { }

  ngOnInit(): void {
      this.choicefieldService.getChoiceFieldValuesByName( this.formField.properties['choicefield'] ).subscribe(
        data => {
          this.choicefieldValues = data;
      });
  }
}
