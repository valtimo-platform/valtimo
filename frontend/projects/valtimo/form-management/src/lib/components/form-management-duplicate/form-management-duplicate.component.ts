/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

import {Component, Inject, OnInit} from '@angular/core';
import {FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {take} from 'rxjs/operators';
import {
  BaseModal,
  ButtonModule,
  InputModule,
  LayerModule,
  ModalModule,
  ModalService,
} from 'carbon-components-angular';
import {CreateFormDefinitionRequest, FormDefinition, FormManagementParams} from '../../models';
import {FormManagementService} from '../../services';
import {noDuplicateFormValidator} from '../../validators/no-duplicate-form.validator';
import {CommonModule} from '@angular/common';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {ValtimoCdsModalDirective} from '@valtimo/components';
import {GlobalNotificationService, ManagementContext} from '@valtimo/shared';

@Component({
  selector: 'valtimo-form-management-duplicate-modal',
  templateUrl: './form-management-duplicate.component.html',
  styleUrls: ['./form-management-duplicate.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ModalModule,
    ButtonModule,
    InputModule,
    ReactiveFormsModule,
    FormsModule,
    LayerModule,
    ValtimoCdsModalDirective,
  ],
})
export class FormManagementDuplicateComponent extends BaseModal implements OnInit {
  public duplicateForm!: FormGroup;

  public get duplicateFormName(): FormControl {
    return this.duplicateForm.controls['duplicateFormName'] as FormControl;
  }

  public getDefaultName(): string {
    return this.formToDuplicate.name + '-duplicate';
  }

  constructor(
    @Inject('formToDuplicate') public readonly formToDuplicate: FormDefinition,
    @Inject('context') public readonly context: ManagementContext,
    @Inject('params') public readonly params: FormManagementParams,
    protected modalService: ModalService,
    protected formManagementService: FormManagementService,
    protected route: ActivatedRoute,
    private router: Router,
    private readonly notificationService: GlobalNotificationService,
    private readonly translateService: TranslateService
  ) {
    super();
  }

  public ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    this.duplicateForm = new FormGroup({
      duplicateFormName: new FormControl(
        this.getDefaultName(),
        Validators.compose([Validators.required]),
        [noDuplicateFormValidator(this.context, this.params, this.formManagementService)]
      ),
    });
    this.duplicateForm.markAllAsTouched();
  }

  public duplicate(): void {
    const control = this.duplicateFormName;
    this.formToDuplicate.name = this.duplicateForm.controls['duplicateFormName'].value;
    const request: CreateFormDefinitionRequest = {
      name: control.value.toString(),
      formDefinition: JSON.stringify(this.formToDuplicate.formDefinition),
    };

    (this.context === 'case'
      ? this.formManagementService.createFormDefinitionsCase(
          this.params.caseDefinitionKey,
          this.params.caseDefinitionVersionTag,
          request
        )
      : this.formManagementService.createFormDefinition(request)
    )
      .pipe(take(1))
      .subscribe({
        next: formDefinition => {
          this.navigateWithNewId(formDefinition.id).then(() => {
            this.closeModal();
            this.notificationService.showToast({
              type: 'success',
              title: this.translateService.instant('formManagement.notifications.duplicated'),
            });
          });
        },
        error: err => {
          if (err.toString().includes('Duplicate name')) {
            control.setErrors({duplicate: true});
          } else {
            control.setErrors({incorrect: true});
          }
        },
      });
  }

  private async navigateWithNewId(newId: string): Promise<boolean> {
    const currentUrl = this.router.url.split('?')[0];
    const segments = currentUrl.split('/');

    const formIdIndex = segments.findIndex(segment => segment.match(/^[a-f0-9-]{36}$/));

    if (formIdIndex !== -1) {
      segments[formIdIndex] = newId;
    }

    const updatedUrl = segments.join('/');
    const queryParams = {...this.route.snapshot.queryParams};

    try {
      return await this.router.navigate([updatedUrl], {queryParams});
    } catch (error) {
      return false;
    }
  }
}
