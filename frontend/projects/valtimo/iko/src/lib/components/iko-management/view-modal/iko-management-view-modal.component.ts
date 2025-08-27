import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {ValtimoCdsModalDirective} from '@valtimo/components';
import {ButtonModule, IconModule, InputModule, ModalModule} from 'carbon-components-angular';
import {BehaviorSubject, Observable, map, switchMap, tap} from 'rxjs';

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
export class IkoManagementViewModalComponent {
  @Input() open = false;
  private readonly _apiKey$ = new BehaviorSubject<string | null>(null);
  @Input() public set apiKey(value: string | null) {
    if (!value) return;

    this._apiKey$.next(value);
  }
  @Input() public set prefillData(value: IkoDataAggregateResponse | null) {
    if (!value) {
      this.resetForm();
      return;
    }
    console.log('prefill', {value});

    this.formGroup.get('key')?.disable();
  }
  @Output() public readonly modalClose = new EventEmitter<any | null>();

  public readonly propertyFields$: Observable<DataAggregatePropertyField[]> = this._apiKey$.pipe(
    switchMap((apiKey: string | null) =>
      this.ikoManagementApiService.getIkoDataAggregateType(apiKey ?? '')
    ),
    switchMap((type: IkoRepositoryConfigResponse) =>
      this.ikoManagementApiService.getIkoDataAggregatePropertyFields(type.type)
    ),
    // map(fields =>
    //   fields.map((field, index) => (index !== 2 ? field : {...field, type: 'dropdown'}))
    // ),
    tap((fields: any[]) => {
      this.addPropertiesForms(fields);
    })
  );
  public formGroup = this.fb.group({
    title: this.fb.control('', Validators.required),
    key: this.fb.control('', Validators.required),
    properties: this.fb.group({}, Validators.required),
  });

  public get propertiesFormGroup(): FormGroup {
    return this.formGroup.get('properties') as FormGroup;
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly ikoManagementApiService: IkoManagementApiService
  ) {}

  public onCancel(): void {
    this.modalClose.emit(null);
    this.resetForm();
  }

  public onSave(): void {
    this.modalClose.emit(this.formGroup.getRawValue());
    this.resetForm();
  }

  public onDeleteRowClick(formKey: string, index: number): void {
    (this.formGroup.get('properties')?.get(formKey) as FormArray).removeAt(index);
  }

  public onAddKeyValue(formKey: string, required: boolean): void {
    (this.formGroup.get('properties')?.get(formKey) as FormArray).push(
      this.fb.group({
        key: this.fb.control('', ...[required ? [Validators.required] : []]),
        value: this.fb.control('', ...[required ? [Validators.required] : []]),
      })
    );
  }

  public onAddDropdownValue(formKey: string, required: boolean): void {
    (this.formGroup.get('properties')?.get(formKey) as FormArray).push(
      this.fb.control('', ...[required ? [Validators.required] : []])
    );
  }

  private addPropertiesForms(fields: DataAggregatePropertyField[]): void {
    const propertiesFormGroup: FormGroup = this.formGroup.get('properties') as FormGroup;
    if (!propertiesFormGroup) return;

    propertiesFormGroup.reset({});
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

  private resetForm(): void {
    this.formGroup.reset({
      title: '',
      key: '',
      properties: {},
    });
  }
}
