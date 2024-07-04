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

import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {AlertService} from '@valtimo/components';
import {FormManagementService} from '../services';
import {CreateFormDefinitionRequest} from '../models';
import {combineLatest} from 'rxjs';
import {take} from 'rxjs/operators';
import {noDuplicateFormValidator} from '../validators/no-duplicate-form.validator';

@Component({
  selector: 'valtimo-form-management-create',
  templateUrl: './form-management-create.component.html',
  styleUrls: ['./form-management-create.component.scss'],
})
export class FormManagementCreateComponent implements OnInit {
  public form: FormGroup;

  constructor(
    private formManagementService: FormManagementService,
    private formBuilder: FormBuilder,
    private router: Router,
    private alertService: AlertService,
    private route: ActivatedRoute
  ) {}

  get formControls() {
    return this.form.controls;
  }

  ngOnInit() {
    this.form = this.formBuilder.group({
      name: new FormControl('', Validators.required, [
        noDuplicateFormValidator(this.formManagementService),
      ]),
    });
  }

  reset() {
    this.form.setValue({
      name: '',
    });
  }

  createFormDefinition() {
    const emptyForm = {
      display: 'form',
      components: [],
    };
    const request: CreateFormDefinitionRequest = {
      name: this.form.value.name,
      formDefinition: JSON.stringify(emptyForm),
    };
    combineLatest([
      this.formManagementService.createFormDefinition(request),
      this.route.queryParams,
    ])
      .pipe(take(1))
      .subscribe(
        ([formDefinition, params]) => {
          this.alertService.success('Created new Form');

          if (params?.upload === 'true') {
            this.router.navigate(['/form-management/edit', formDefinition.id], {
              queryParams: {upload: 'true'},
            });
          } else {
            this.router.navigate(['/form-management/edit', formDefinition.id]);
          }
        },
        err => {
          this.alertService.error('Error creating new Form');
        }
      );
  }
}
