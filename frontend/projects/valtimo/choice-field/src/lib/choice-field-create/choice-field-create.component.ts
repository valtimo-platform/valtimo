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

import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ChoiceFieldService } from '../choice-field.service';
import { AlertService } from '@valtimo/components';

@Component({
  selector: 'valtimo-choice-field-create',
  templateUrl: './choice-field-create.component.html',
  styleUrls: ['./choice-field-create.component.css']
})
export class ChoiceFieldCreateComponent implements OnInit {

  public form: FormGroup;

  constructor(
    private router: Router,
    private formBuilder: FormBuilder,
    private service: ChoiceFieldService,
    private alertService: AlertService
  ) { }

  ngOnInit() {
    this.reset();
  }

  public get formControls() {
    return this.form.controls;
  }

  private createFormGroup() {
    return this.formBuilder.group({
      keyName: new FormControl('', Validators.required),
      title: new FormControl('', Validators.required)
    });
  }

  public onSubmit() {
    this.service.create(this.form.value).subscribe(result => {
      this.router.navigate([`/choice-fields/field/${result.id}`]);
      this.alertService.success('New choice field has been created');
    });
  }

  public reset() {
    this.form = this.createFormGroup();
  }

}
