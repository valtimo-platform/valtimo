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

import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {FormBuilder, FormControl, FormGroup} from '@angular/forms';
import {FormField} from './formfield/formfield.model';
import {CamundaFormfieldService} from './formfield/camunda-formfield.service';
import {Location} from '@angular/common';

@Component({
  selector: 'valtimo-camunda-generated-form',
  templateUrl: './camunda-generated-form.component.html'
})
export class CamundaGeneratedFormComponent implements OnInit {

  @Output() submitted: EventEmitter<any> = new EventEmitter<any>();
  @Input() formFields: FormField[] = [];
  public formGroup: FormGroup;

  constructor(
    private formBuilder: FormBuilder,
    private camundaFormFieldService: CamundaFormfieldService,
    private location: Location
  ) {
  }

  ngOnInit(): void {
    this.formGroup = this.createFormGroup();
  }

  private createFormGroup() {
    const group = this.formBuilder.group({});
    this.formFields.forEach(formField => {
      const control = new FormControl({
        value: formField.defaultValue,
        disabled: this.camundaFormFieldService.isFormFieldDisabled(formField)
      }, this.camundaFormFieldService.getValidatorTypes(formField));
      group.addControl(formField.id, control);
    });
    return group;
  }

  public reset() {
    this.formGroup.reset();
  }

  public back() {
    this.location.back();
  }

  public handleSubmit(event) {
    event.preventDefault();
    event.stopPropagation();
    this.submitted.emit(this.formGroup.value);
  }

}
