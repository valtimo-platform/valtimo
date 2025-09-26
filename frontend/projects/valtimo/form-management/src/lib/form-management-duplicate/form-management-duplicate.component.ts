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

import {Component, Inject} from '@angular/core';
import {combineLatest} from 'rxjs';
import {take} from 'rxjs/operators';
import {FormControl, FormGroup, Validators} from '@angular/forms';
import {CreateFormDefinitionRequest} from '../models';
import {BaseModal} from 'carbon-components-angular/modal';
import {FormManagementService} from '../services';
import {ActivatedRoute, Router} from '@angular/router';
import {AlertService, ModalService} from '@valtimo/components';
import {noDuplicateFormValidator} from '../validators/no-duplicate-form.validator';

@Component({
  selector: 'valtimo-form-management-duplicate-modal',
  templateUrl: './form-management-duplicate.component.html',
  styleUrls: ['./form-management-duplicate.component.scss'],
})
export class FormManagementDuplicateComponent extends BaseModal {
  duplicateForm = new FormGroup({
    duplicateFormName: new FormControl(
      this.getDefaultName(),
      Validators.compose([Validators.required]),
      [noDuplicateFormValidator(this.formManagementService)]
    ),
  });

  constructor(
    @Inject('formToDuplicate') public formToDuplicate,
    protected modalService: ModalService,
    protected formManagementService: FormManagementService,
    private alertService: AlertService,
    protected route: ActivatedRoute,
    private router: Router
  ) {
    super();
    this.duplicateForm.markAllAsTouched();
  }

  public duplicate() {
    const control = this.duplicateFormName;

    const request: CreateFormDefinitionRequest = {
      name: control.value.toString(),
      formDefinition: JSON.stringify(this.formToDuplicate.formDefinition),
    };
    combineLatest([
      this.formManagementService.createFormDefinition(request),
      this.route.queryParams,
    ])
      .pipe(take(1))
      .subscribe(
        ([formDefinition, params]) => {
          this.alertService.success('Created new Form');
          this.router
            .navigateByUrl(`/form-management/edit/${formDefinition.id}`)
            .then(function (result) {
              window.location.reload();
            });
        },
        err => {
          if (err.toString().includes('Duplicate name')) {
            control.setErrors({duplicate: true});
          } else {
            control.setErrors({incorrect: true});
          }
        }
      );
  }

  get duplicateFormName(): FormControl {
    return this.duplicateForm.controls['duplicateFormName'];
  }

  public getDefaultName(): string {
    return this.formToDuplicate.name + '-duplicate';
  }
}
