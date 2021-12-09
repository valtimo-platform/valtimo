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
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {ChoiceField, ChoiceFieldValue} from '@valtimo/contract';
import {ActivatedRoute, Router} from '@angular/router';
import {ChoiceFieldService} from '../choice-field.service';
import {AlertService} from '@valtimo/components';

@Component({
  selector: 'valtimo-choice-field-value-detail',
  templateUrl: './choice-field-value-detail.component.html',
  styleUrls: ['./choice-field-value-detail.component.css']
})
export class ChoiceFieldValueDetailComponent implements OnInit {

  public choiceFieldValueId: string;
  public form: FormGroup;
  public choiceField: ChoiceField;
  public choiceFieldValue: ChoiceFieldValue;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private formBuilder: FormBuilder,
    private service: ChoiceFieldService,
    private alertService: AlertService
  ) {
    const snapshot = this.route.snapshot.paramMap;
    this.choiceFieldValueId = snapshot.get('valueId');
  }

  ngOnInit() {
    this.reset();
  }

  public get formControls() {
    return this.form.controls;
  }

  private initData(choiceFieldValueId) {
    this.service.getValue(choiceFieldValueId).subscribe(result => {
      this.choiceField = result.choiceField;
      this.choiceFieldValue = result;
      this.setValues();
    });
  }

  private createFormGroup() {
    return this.formBuilder.group({
      id: new FormControl('', Validators.required),
      name: new FormControl('', Validators.required),
      value: new FormControl('', Validators.required),
      sortOrder: new FormControl('', Validators.required),
      deprecated: new FormControl('', Validators.required)
    });
  }

  private setValues() {
    if (this.choiceField) {
      // set form values
      this.form.controls.id.setValue(this.choiceFieldValue.id);
      this.form.controls.name.setValue(this.choiceFieldValue.name);
      this.form.controls.value.setValue(this.choiceFieldValue.value);
      this.form.controls.sortOrder.setValue(this.choiceFieldValue.sortOrder);
      this.form.controls.deprecated.setValue(this.choiceFieldValue.deprecated);
    }
  }

  public reset() {
    this.form = this.createFormGroup();
    this.initData(this.choiceFieldValueId);
  }

  public onSubmit() {
    this.service.updateValue(this.form.value, this.choiceField.keyName).subscribe(() => {
      this.reset();
      this.alertService.success('Choice field value details have been updated');
    });
  }

}
