import {CommonModule} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {CARBON_CONSTANTS, ValtimoCdsModalDirective} from '@valtimo/components';
import {ButtonModule, IconModule, InputModule, ModalModule} from 'carbon-components-angular';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  Observable,
  Subscription,
  switchMap,
  tap,
} from 'rxjs';
import {
  DataAggregatePropertyField,
  IkoDataAggregateResponse,
  IkoRepositoryConfigResponse,
} from '../../../models';
import {IkoManagementApiService} from '../../../services';

@Component({
  selector: 'valtimo-iko-management-view-modal',
  templateUrl: './iko-management-view-modal.component.html',
  styleUrl: './iko-management-view-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ModalModule,
    ValtimoCdsModalDirective,
    InputModule,
    ReactiveFormsModule,
    ButtonModule,
    IconModule,
  ],
})
export class IkoManagementViewModalComponent implements OnInit, OnDestroy {
  private readonly _open$ = new BehaviorSubject<boolean>(false);
  @Input() public set open(value: boolean) {
    this._open$.next(value);

    if (!value) this.resetForm();
  }
  public get open$(): Observable<boolean> {
    return this._open$.asObservable();
  }
  private readonly _apiKey$ = new BehaviorSubject<string | null>(null);
  @Input() public set apiKey(value: string | null) {
    if (!value) return;

    this._apiKey$.next(value);
  }
  private readonly _prefillData$ = new BehaviorSubject<IkoDataAggregateResponse | null>(null);
  @Input() public set prefillData(value: IkoDataAggregateResponse | null) {
    this._prefillData$.next(value);
    if (!value) return;

    this.formGroup.get('key')?.disable();
  }
  @Output() public readonly modalClose = new EventEmitter<any | null>();

  public readonly propertyFields$: Observable<DataAggregatePropertyField[]> = this.open$.pipe(
    filter((open: boolean) => !!open),
    switchMap(() => this._apiKey$),
    switchMap((apiKey: string | null) =>
      this.ikoManagementApiService.getIkoDataAggregateType(apiKey ?? '')
    ),
    switchMap((type: IkoRepositoryConfigResponse) =>
      this.ikoManagementApiService.getIkoDataAggregatePropertyFields(type.type)
    ),
    tap((fields: DataAggregatePropertyField[]) => {
      this.addPropertiesForms(fields);
    })
  );
  public formGroup = this.fb.group({
    title: this.fb.control('', Validators.required),
    key: this.fb.control('', Validators.required),
    properties: this.fb.group({}, Validators.required),
  });

  private readonly _subscriptions = new Subscription();

  public get propertiesFormGroup(): FormGroup {
    return this.formGroup.get('properties') as FormGroup;
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly ikoManagementApiService: IkoManagementApiService
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      combineLatest([this._prefillData$, this.propertyFields$]).subscribe(
        ([prefillData, propertyFields]) => {
          this.mapPrefillDataToForm(prefillData, propertyFields);
        }
      )
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onCancel(): void {
    this.modalClose.emit(null);
  }

  public onSave(): void {
    this.modalClose.emit(this.formGroup.getRawValue());
  }

  public onDeleteRowClick(formKey: string, index: number): void {
    (this.formGroup.get('properties')?.get(formKey) as FormArray).removeAt(index);
  }

  public onAddKeyValue(formKey: string, required: boolean): void {
    (this.formGroup.get('properties')?.get(formKey) as FormArray)?.push(
      this.fb.group({
        key: this.fb.control('', ...[required ? [Validators.required] : []]),
        value: this.fb.control('', ...[required ? [Validators.required] : []]),
      })
    );
  }

  public onAddDropdownValue(formKey: string, required: boolean): void {
    (this.formGroup.get('properties')?.get(formKey) as FormArray)?.push(
      this.fb.control('', ...[required ? [Validators.required] : []])
    );
  }

  private addPropertiesForms(fields: DataAggregatePropertyField[]): void {
    const propertiesFormGroup: FormGroup = this.formGroup.get('properties') as FormGroup;
    if (!propertiesFormGroup) return;

    fields.forEach((field: DataAggregatePropertyField) => {
      switch (field.type) {
        case 'text':
        case 'url':
        case 'integer':
          propertiesFormGroup.addControl(
            field.key,
            this.fb.control('', ...(field.required ? [Validators.required] : []))
          );
          break;
        case 'dropdown':
          propertiesFormGroup.addControl(
            field.key,
            this.fb.array([this.fb.control('', Validators.required)])
          );
          break;
        case 'keyValueList':
          propertiesFormGroup.addControl(
            field.key,
            this.fb.array([
              this.fb.group({
                key: this.fb.control('', Validators.required),
                value: this.fb.control('', Validators.required),
              }),
            ])
          );
      }
    });
  }

  private mapPrefillDataToForm(
    prefillData: IkoDataAggregateResponse | null,
    propertyFields: DataAggregatePropertyField[]
  ): void {
    const propertiesFormGroup: FormGroup = this.formGroup.get('properties') as FormGroup;
    if (!prefillData || !propertiesFormGroup) return;

    propertyFields.forEach((field: DataAggregatePropertyField) => {
      if (field.type === 'dropdown')
        prefillData.properties[field.key].forEach((_, index: number) => {
          if (index !== prefillData.properties[field.key].length - 1)
            this.onAddDropdownValue(field.key, field.required);
        });

      if (field.type === 'keyValueList') {
        prefillData.properties[field.key].forEach((_, index: number) => {
          if (index !== prefillData.properties[field.key].length - 1)
            this.onAddKeyValue(field.key, field.required);
        });
      }
    });

    this.formGroup.patchValue(prefillData);
  }

  private resetForm(): void {
    setTimeout(() => {
      this.formGroup.reset({
        title: '',
        key: '',
      });
      this.formGroup.setControl('properties', this.fb.group({}, Validators.required));
      this.formGroup.get('key')?.enable();
    }, CARBON_CONSTANTS.modalAnimationMs);
  }
}
