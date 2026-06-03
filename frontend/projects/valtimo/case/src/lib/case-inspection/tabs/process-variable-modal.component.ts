/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

import {CommonModule} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {SelectItem, SelectModule, ValtimoCdsModalDirective} from '@valtimo/components';
import {
  ButtonModule,
  InputModule,
  LayerModule,
  ModalModule,
  NumberModule,
  ToggleModule,
} from 'carbon-components-angular';
import {
  ProcessVariable,
  ProcessVariableMutationRequest,
  ProcessVariableType,
} from '../models/case-inspection.models';

const PROCESS_VARIABLE_TYPES: ProcessVariableType[] = [
  'STRING',
  'INTEGER',
  'LONG',
  'DOUBLE',
  'BOOLEAN',
  'JSON',
];

@Component({
  standalone: true,
  selector: 'valtimo-case-inspection-process-variable-modal',
  templateUrl: './process-variable-modal.component.html',
  styleUrl: './process-variable-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ReactiveFormsModule,
    ButtonModule,
    InputModule,
    LayerModule,
    ModalModule,
    NumberModule,
    ToggleModule,
    SelectModule,
    ValtimoCdsModalDirective,
  ],
})
export class CaseInspectionProcessVariableModalComponent implements OnChanges {
  @Input() public open = false;
  @Input() public mode: 'create' | 'edit' = 'create';
  @Input() public initialVariable: ProcessVariable | null = null;

  @Output() public readonly modalClosed = new EventEmitter<ProcessVariableMutationRequest | null>();

  public readonly $invalidJson = signal<boolean>(false);

  public readonly typeSelectItems: SelectItem[] = PROCESS_VARIABLE_TYPES.map(type => ({
    id: type,
    translationKey: `case.inspection.processes.variableModal.types.${type}`,
  }));

  public readonly formGroup = this.fb.group({
    name: this.fb.control('', [Validators.required, Validators.pattern(/\S/)]),
    type: this.fb.control<ProcessVariableType>('STRING', Validators.required),
    valueText: this.fb.control(''),
    valueNumber: this.fb.control<number | null>(null),
    valueBoolean: this.fb.control<boolean>(false),
    valueJson: this.fb.control('', this.jsonValidator()),
  });

  public get name(): AbstractControl<string | null> {
    return this.formGroup.get('name') as AbstractControl<string | null>;
  }

  public get type(): AbstractControl<ProcessVariableType | null> {
    return this.formGroup.get('type') as AbstractControl<ProcessVariableType | null>;
  }

  constructor(private readonly fb: FormBuilder) {
    this.type.valueChanges.subscribe(t => this.applyTypeValidators(t));
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes.open && this.open) {
      this.resetForm();
      if (this.mode === 'edit' && this.initialVariable) {
        this.applyInitialVariable(this.initialVariable);
      }
      this.applyNameDisabled();
    }
  }

  public onCancel(): void {
    this.modalClosed.emit(null);
  }

  public onConfirm(): void {
    if (this.formGroup.invalid) {
      this.formGroup.markAllAsTouched();
      return;
    }
    const raw = this.formGroup.getRawValue();
    const request: ProcessVariableMutationRequest = {
      name: (raw.name ?? '').trim(),
      type: raw.type as ProcessVariableType,
      value: this.extractValue(raw.type as ProcessVariableType),
    };
    this.modalClosed.emit(request);
  }

  private extractValue(type: ProcessVariableType): unknown {
    const raw = this.formGroup.getRawValue();
    switch (type) {
      case 'STRING':
        return raw.valueText ?? '';
      case 'INTEGER':
      case 'LONG':
      case 'DOUBLE':
        return raw.valueNumber;
      case 'BOOLEAN':
        return !!raw.valueBoolean;
      case 'JSON':
        return raw.valueJson ? JSON.parse(raw.valueJson) : null;
    }
  }

  private applyTypeValidators(type: ProcessVariableType | null): void {
    const text = this.formGroup.get('valueText')!;
    const num = this.formGroup.get('valueNumber')!;
    const bool = this.formGroup.get('valueBoolean')!;
    const json = this.formGroup.get('valueJson')!;

    text.clearValidators();
    num.clearValidators();
    bool.clearValidators();
    json.clearValidators();

    switch (type) {
      case 'INTEGER':
      case 'LONG':
        num.setValidators([Validators.required, Validators.pattern(/^-?\d+$/)]);
        break;
      case 'DOUBLE':
        num.setValidators([Validators.required, Validators.pattern(/^-?\d+(\.\d+)?$/)]);
        break;
      case 'JSON':
        json.setValidators(this.jsonValidator());
        break;
      default:
        break;
    }

    [text, num, bool, json].forEach(c => c.updateValueAndValidity({emitEvent: false}));
  }

  private applyInitialVariable(variable: ProcessVariable): void {
    const inferredType = this.inferType(variable.type);
    this.name.setValue(variable.name);
    this.type.setValue(inferredType);

    switch (inferredType) {
      case 'STRING':
        this.formGroup
          .get('valueText')!
          .setValue(variable.value == null ? '' : String(variable.value));
        break;
      case 'INTEGER':
      case 'LONG':
      case 'DOUBLE':
        this.formGroup
          .get('valueNumber')!
          .setValue(
            typeof variable.value === 'number' ? variable.value : Number(variable.value ?? 0)
          );
        break;
      case 'BOOLEAN':
        this.formGroup.get('valueBoolean')!.setValue(variable.value === true);
        break;
      case 'JSON':
        this.formGroup
          .get('valueJson')!
          .setValue(variable.value == null ? '' : JSON.stringify(variable.value, null, 2));
        break;
    }
  }

  private inferType(operatonType: string | null | undefined): ProcessVariableType {
    switch ((operatonType ?? '').toLowerCase()) {
      case 'string':
        return 'STRING';
      case 'integer':
        return 'INTEGER';
      case 'long':
        return 'LONG';
      case 'double':
        return 'DOUBLE';
      case 'boolean':
        return 'BOOLEAN';
      default:
        return 'JSON';
    }
  }

  private applyNameDisabled(): void {
    if (this.mode === 'edit') {
      this.name.disable({emitEvent: false});
    } else {
      this.name.enable({emitEvent: false});
    }
  }

  private resetForm(): void {
    this.formGroup.reset({
      name: '',
      type: 'STRING',
      valueText: '',
      valueNumber: null,
      valueBoolean: false,
      valueJson: '',
    });
    this.$invalidJson.set(false);
    this.applyTypeValidators('STRING');
  }

  private jsonValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const raw = control.value;
      if (raw == null || raw === '') {
        this.$invalidJson?.set(false);
        return null;
      }
      try {
        JSON.parse(raw);
        this.$invalidJson?.set(false);
        return null;
      } catch {
        this.$invalidJson?.set(true);
        return {invalidJson: true};
      }
    };
  }
}
