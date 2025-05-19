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
import {TranslateModule} from '@ngx-translate/core';
import {ValtimoCdsModalDirectiveModule} from '@valtimo/components';
import {ManagementContext} from '@valtimo/shared';

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
    ValtimoCdsModalDirectiveModule,
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
    @Inject('disabledPendingChangesCallback')
    public readonly disablePendingChangesCallback: () => void,
    @Inject('context') public readonly context: ManagementContext,
    @Inject('params') public readonly params: FormManagementParams,
    protected modalService: ModalService,
    protected formManagementService: FormManagementService,
    protected route: ActivatedRoute,
    private router: Router
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
          this.disablePendingChangesCallback();
          this.navigateWithNewId(formDefinition.id).then(() => window.location.reload());
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
