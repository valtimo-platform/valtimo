import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component} from '@angular/core';
import {
  CreateFormDefinitionRequest,
  FormManagementModule,
  FormManagementService,
} from '@valtimo/form-management';
import {ButtonModule, InputModule, ModalModule} from 'carbon-components-angular';
import {BehaviorSubject, Observable, combineLatest, map, take, tap} from 'rxjs';
import {BuildingBlockService} from '../../../services';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {AlertService, CARBON_THEME} from '@valtimo/components';

@Component({
  selector: 'valtimo-building-block-forms',
  templateUrl: './building-block-forms.component.html',
  styleUrl: './building-block-forms.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    FormManagementModule,
    ButtonModule,
    ReactiveFormsModule,
    ModalModule,
    InputModule,
  ],
})
export class BuildingBlockFormsComponent {
  public readonly backButtonActive$ = this.buildingBlockService.backButtonActive$;
  public readonly createModalOpen$ = new BehaviorSubject<boolean>(false);

  private readonly _formId$ = new BehaviorSubject<string | null>(null);
  public readonly formId$: Observable<string | null> = combineLatest([
    this._formId$,
    this.buildingBlockService.backButtonActive$,
  ]).pipe(map(([formId, backButtonActive]) => (backButtonActive ? formId : null)));

  public readonly nameControl = this.fb.control('', Validators.required);

  constructor(
    private readonly alertService: AlertService,
    private readonly buildingBlockService: BuildingBlockService,
    private readonly fb: FormBuilder,
    private readonly formManagementService: FormManagementService
  ) {}

  public onEditForm(formId: string): void {
    this.buildingBlockService.viewChanged();
    this._formId$.next(formId);
  }

  public onOpenCreateForm(): void {
    this.createModalOpen$.next(true);
  }

  public onCloseCreateModal(): void {
    this.createModalOpen$.next(false);
  }

  public onCreateForm(): void {
    const emptyForm = {
      display: 'form',
      components: [],
    };
    const request: CreateFormDefinitionRequest = {
      name: this.nameControl.value ?? '',
      formDefinition: JSON.stringify(emptyForm),
    };

    this.formManagementService
      .createFormDefinition(request)
      .pipe(
        take(1),
        tap(() => this.createModalOpen$.next(false))
      )
      .subscribe({
        next: formDefinition => {
          this.alertService.success('Created new Form');
          this.onEditForm(formDefinition.id);
        },
        error: () => {
          this.alertService.error('Error creating new Form');
        },
      });
  }

  public onFormCallComplete(): void {
    this.buildingBlockService.backButtonClick();
    this._formId$.next(null);
  }
}
