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
import {Component, Input, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
  FormArray,
  FormGroup,
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
} from '@angular/forms';
import {SelectItem, SelectModule} from '@valtimo/components';
import {
  ButtonModule,
  IconModule,
  IconService,
  InputModule,
  LayerModule,
  TooltipModule,
} from 'carbon-components-angular';
import {TranslatePipe} from '@ngx-translate/core';
import {PropertyField} from '../../models';
import {computed, effect} from '@angular/core';
import {Information16} from '@carbon/icons';

@Component({
  selector: 'valtimo-iko-management-properties',
  templateUrl: './iko-management-properties.component.html',
  styleUrl: './iko-management-properties.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    ButtonModule,
    InputModule,
    IconModule,
    LayerModule,
    SelectModule,
    TooltipModule,
  ],
})
export class PropertiesFormComponent {
  @Input({required: true}) propertiesFormGroup!: FormGroup;

  public readonly $fields = signal<PropertyField[]>([]);
  @Input() public set fields(fields: PropertyField[]) {
    if (fields) {
      this.applyPropertyControls(this.fb, this.propertiesFormGroup, fields);
      this.$fields.set(fields);
    }
  }

  public readonly $prefillData = signal<Record<string, any>>({});
  @Input() public set prefillData(value: Record<string, any | null> | null) {
    this.$prefillData.set(value ?? {});
  }

  public readonly $selectItems = computed(() =>
    this.$fields()
      .filter(field => field?.dropdownList)
      .reduce((acc: Record<string, SelectItem[]>, field) => {
        acc[field.key] = field.dropdownList.map(item => ({
          id: item.first,
          text: item.second,
        }));
        return acc;
      }, {})
  );

  private readonly combined = computed(() => ({
    prefill: this.$prefillData(),
    fields: this.$fields(),
  }));

  private readonly _effect = effect(() => {
    const {prefill, fields} = this.combined();
    this.mapPrefillDataToForm(prefill, fields);
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Information16]);
  }

  public getFa(key: string): FormArray {
    return this.propertiesFormGroup.get(key) as FormArray;
  }

  public onAddKeyValue(key: string, required?: boolean) {
    this.addKeyValue(this.getFa(key), this.fb, required);
  }

  public onDeleteRowClick(key: string, index: number) {
    this.getFa(key).removeAt(index);
  }

  public applyPropertyControls(
    fb: FormBuilder,
    propertiesGroup: FormGroup,
    fields: PropertyField[]
  ): void {
    fields.forEach(field => {
      if (propertiesGroup.contains(field.key)) return;

      switch (field.type) {
        case 'text':
        case 'url':
        case 'integer':
        case 'dropdown':
          propertiesGroup.addControl(
            field.key,
            fb.control('', field.required ? [Validators.required] : [])
          );
          break;
        case 'keyValueList':
          propertiesGroup.addControl(
            field.key,
            fb.array([
              fb.group({
                key: fb.control('', Validators.required),
                value: fb.control('', Validators.required),
              }),
            ])
          );
          break;
      }
    });
  }

  public getControlInvalid(controlKey: string): boolean {
    const control: AbstractControl | null = this.propertiesFormGroup.get(controlKey);

    if (!control) {
      return true;
    }

    return !control.valid && !control.pristine;
  }

  private mapPrefillDataToForm(
    prefillData: Record<string, any>,
    propertyFields: PropertyField[]
  ): void {
    if (!prefillData || !this.propertiesFormGroup) return;

    propertyFields.forEach((field: PropertyField) => {
      if (field.type === 'keyValueList') {
        const keyValueList = !prefillData[field.key]
          ? [{key: '', value: ''}]
          : Array.isArray(prefillData[field.key])
            ? prefillData[field.key]
            : Object.entries(prefillData[field.key]).map(([key, value]) => ({
                key,
                value,
              }));
        this.getFa(field.key).clear();
        keyValueList.forEach(item => this.onAddKeyValue(field.key, field.required));
        prefillData[field.key] = keyValueList;
      }
    });

    this.propertiesFormGroup.patchValue(prefillData);
  }

  private addKeyValue(arr: FormArray, fb: FormBuilder, required?: boolean) {
    arr.push(
      fb.group({
        key: fb.control('', required ? Validators.required : []),
        value: fb.control('', required ? Validators.required : []),
      })
    );
  }
}
