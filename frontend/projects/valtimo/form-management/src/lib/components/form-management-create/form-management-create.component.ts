import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import {FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import {ValtimoCdsModalDirectiveModule, WidgetModule} from '@valtimo/components';
import {FormManagementService} from '../../services';
import {CreateFormDefinitionRequest, FormManagementParams} from '../../models';
import {combineLatest, map, Observable, of, switchMap, tap} from 'rxjs';
import {noDuplicateFormValidator} from '../../validators/no-duplicate-form.validator';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {
  ButtonModule,
  InputModule,
  LayerModule,
  ModalModule,
  TilesModule,
} from 'carbon-components-angular';
import {ManagementContext} from '@valtimo/config';
import {take} from 'rxjs/operators';

@Component({
  selector: 'valtimo-form-management-create',
  templateUrl: './form-management-create.component.html',
  styleUrls: ['./form-management-create.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ButtonModule,
    InputModule,
    WidgetModule,
    InputModule,
    TilesModule,
    LayerModule,
    ModalModule,
    ValtimoCdsModalDirectiveModule,
    ButtonModule,
  ],
})
export class FormManagementCreateComponent implements OnInit {
  @Output() public readonly goBackEvent = new EventEmitter<void>();
  @Output() public readonly afterCreateEvent = new EventEmitter<string>();
  @Output() public readonly afterUploadEvent = new EventEmitter<string>();

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

  public form: FormGroup;

  constructor(
    private readonly formManagementService: FormManagementService,
    private readonly formBuilder: FormBuilder,
    private readonly route: ActivatedRoute
  ) {}

  public ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    combineLatest([this.context$, this.caseManagementRouteParams$])
      .pipe(
        take(1),
        tap(([context, caseManagementParams]) => {
          this.form = this.formBuilder.group({
            name: new FormControl('', Validators.required, [
              noDuplicateFormValidator(context, caseManagementParams, this.formManagementService),
            ]),
          });
        })
      )
      .subscribe();
  }

  public get formControls(): FormGroup['controls'] {
    return this.form?.controls;
  }

  public onBackButtonClick(): void {
    this.goBackEvent.emit();
  }

  public reset(): void {
    this.form.setValue({name: ''});
  }

  public onCloseEvent(): void {
    this.goBackEvent.emit();
  }

  public createFormDefinition(): void {
    const emptyForm = {display: 'form', components: []};
    const request: CreateFormDefinitionRequest = {
      name: this.form.value.name,
      formDefinition: JSON.stringify(emptyForm),
    };

    combineLatest([this.context$, this.caseManagementRouteParams$])
      .pipe(
        switchMap(([context, caseManagementParams]) =>
          context === 'case'
            ? this.formManagementService.createFormDefinitionsCase(
                caseManagementParams.definitionName,
                caseManagementParams.versionTag,
                request
              )
            : this.formManagementService.createFormDefinition(request)
        ),
        switchMap(formDefinition => combineLatest([of(formDefinition), this.route.queryParams])),
        tap(([formDefinition, params]) => {
          if (params?.upload === 'true') {
            this.afterUploadEvent.emit(formDefinition.id);
          } else {
            this.afterCreateEvent.emit(formDefinition.id);
          }
        })
      )
      .subscribe();
  }
}
