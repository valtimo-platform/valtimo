import {Component, Inject, OnInit} from '@angular/core';
import {FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {combineLatest, Observable, of} from 'rxjs';
import {map, take, tap} from 'rxjs/operators';
import {
  BaseModal,
  ButtonModule,
  InputModule,
  LayerModule,
  ModalModule,
  ModalService,
} from 'carbon-components-angular';
import {CreateFormDefinitionRequest, FormManagementParams} from '../../models';
import {FormManagementService} from '../../services';
import {noDuplicateFormValidator} from '../../validators/no-duplicate-form.validator';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {ManagementContext} from '@valtimo/config';
import {ValtimoCdsModalDirectiveModule} from '@valtimo/components';

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
  public readonly context$: Observable<ManagementContext | ''> = this.route.data.pipe(
    map(data => data && (data['context'] as ManagementContext))
  );

  public readonly caseManagementRouteParams$: Observable<FormManagementParams | null> = this.route
    .parent
    ? this.route.parent.params.pipe(
        map(({caseDefinitionName, caseVersionTag}) =>
          caseDefinitionName && caseVersionTag
            ? {definitionName: caseDefinitionName, versionTag: caseVersionTag}
            : null
        )
      )
    : of(null);

  public duplicateForm!: FormGroup;

  public get duplicateFormName(): FormControl {
    return this.duplicateForm.controls['duplicateFormName'] as FormControl;
  }

  public getDefaultName(): string {
    return this.formToDuplicate.name + '-duplicate';
  }

  constructor(
    @Inject('formToDuplicate') public formToDuplicate,
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
    combineLatest([this.context$, this.caseManagementRouteParams$])
      .pipe(
        take(1),
        tap(([context, caseManagementParams]) => {
          this.duplicateForm = new FormGroup({
            duplicateFormName: new FormControl(
              this.getDefaultName(),
              Validators.compose([Validators.required]),
              [noDuplicateFormValidator(context, caseManagementParams, this.formManagementService)]
            ),
          });
          this.duplicateForm.markAllAsTouched();
        })
      )
      .subscribe();
  }

  public duplicate(): void {
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
      .subscribe({
        next: ([formDefinition]) => {
          this.router
            .navigate([], {
              relativeTo: this.route,
              queryParams: {edit: formDefinition.id},
              queryParamsHandling: 'merge',
            })
            .then(() => window.location.reload());
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
}
