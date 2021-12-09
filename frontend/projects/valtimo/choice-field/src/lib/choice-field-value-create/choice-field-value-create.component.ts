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
import {ChoiceField} from '@valtimo/contract';
import {ActivatedRoute, Router} from '@angular/router';
import {ChoiceFieldService} from '../choice-field.service';
import {AlertService} from '@valtimo/components';

@Component({
  selector: 'valtimo-choice-field-value-create',
  templateUrl: './choice-field-value-create.component.html',
  styleUrls: ['./choice-field-value-create.component.css']
})
export class ChoiceFieldValueCreateComponent implements OnInit {

  public choiceFieldId: string;
  public form: FormGroup;
  public choiceField: ChoiceField;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private formBuilder: FormBuilder,
    private service: ChoiceFieldService,
    private alertService: AlertService
  ) {
    const snapshot = this.route.snapshot.paramMap;
    this.choiceFieldId = snapshot.get('id');
  }

  ngOnInit() {
    this.reset();
  }

  public get formControls() {
    return this.form.controls;
  }

  private createFormGroup() {
    return this.formBuilder.group({
      name: new FormControl('', Validators.required),
      value: new FormControl('', Validators.required),
      sortOrder: new FormControl('', Validators.required),
      deprecated: new FormControl('', Validators.required)
    });
  }

  private initData(id) {
    this.service.get(id).subscribe(result => {
      this.choiceField = result;
      this.setValues();
    });
  }

  private setValues() {
    if (this.choiceField) {
      // set form values default false
      this.form.controls.deprecated.setValue(false);
    }
  }

  public onSubmit() {
    this.service.createValue(this.form.value, this.choiceField.keyName).subscribe(result => {
      this.router.navigate([`/choice-fields/field/${encodeURI(this.choiceFieldId)}`]);
      this.alertService.success('New choice field value has been created');
    });
  }

  public reset() {
    this.form = this.createFormGroup();
    this.initData(this.choiceFieldId);
  }
}
