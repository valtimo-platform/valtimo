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
  Output,
  signal,
} from '@angular/core';
import {FormBuilder, FormControl, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {
  CarbonMultiInputModule,
  MultiInputOutput,
  MultiInputValues,
  runAfterCarbonModalClosed,
  ValtimoCdsModalDirective,
} from '@valtimo/components';
import {ButtonModule, InputModule, LayerModule, ModalModule} from 'carbon-components-angular';
import {BehaviorSubject} from 'rxjs';
import {DECISION_FORM_TEST_IDS} from '../constants';
import {DecisionFormValue, DecisionInputVariable} from '../models';

@Component({
  selector: 'valtimo-decision-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './decision-form-modal.component.html',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ModalModule,
    ButtonModule,
    InputModule,
    LayerModule,
    ValtimoCdsModalDirective,
    CarbonMultiInputModule,
  ],
  styleUrl: './decision-form-modal.component.scss',
})
export class DecisionFormModalComponent {
  @Input() public titleKey = 'decisions.createModal.title';
  @Input() public submitKey = 'interface.create';

  @Output() submitEvent = new EventEmitter<DecisionFormValue>();

  public readonly MAX_INPUT_VARIABLES = 100;

  public readonly modalOpen$ = new BehaviorSubject<boolean>(false);
  public readonly defaultInputVariables$ = new BehaviorSubject<MultiInputValues>([
    {key: '', value: ''},
  ]);

  /** True when a row has a label but no process variable (the process variable is required). */
  public readonly $inputVariablesInvalid = signal<boolean>(false);

  protected readonly testIds = DECISION_FORM_TEST_IDS;

  public readonly form = this.formBuilder.group({
    name: this.formBuilder.control('', [Validators.required]),
  });

  private _inputVariables: DecisionInputVariable[] = [];

  public get name(): FormControl<string> {
    return this.form.get('name') as FormControl<string>;
  }

  constructor(private readonly formBuilder: FormBuilder) {}

  public open(initial?: DecisionFormValue): void {
    const inputVariables = initial?.inputVariables ?? [];
    this._inputVariables = inputVariables.map(({label, expression}) => ({label, expression}));
    // The multi-input renders key (left) then value (right); the process variable is
    // the first column, so it maps to key and the label maps to value.
    this.defaultInputVariables$.next(
      inputVariables.length
        ? inputVariables.map(({label, expression}) => ({key: expression, value: label}))
        : [{key: '', value: ''}]
    );
    this.updateInputVariablesValidity();
    this.form.reset({name: initial?.name ?? ''});
    this.modalOpen$.next(true);
  }

  /** Convenience used by the "create" trigger, which opens an empty form. */
  public openModal(): void {
    this.open();
  }

  public closeModal(): void {
    this.modalOpen$.next(false);
    runAfterCarbonModalClosed(() => {
      this.form.reset({name: ''});
      this._inputVariables = [];
      this.$inputVariablesInvalid.set(false);
      this.defaultInputVariables$.next([{key: '', value: ''}]);
    });
  }

  public onInputVariablesChange(values: MultiInputOutput): void {
    this._inputVariables = ((values as MultiInputValues) ?? []).map(row => ({
      label: row.value ?? '',
      expression: row.key ?? '',
    }));
    this.updateInputVariablesValidity();
  }

  public submit(): void {
    if (this.form.invalid || this.$inputVariablesInvalid()) {
      this.form.markAllAsTouched();
      return;
    }

    const name = (this.form.getRawValue().name ?? '').trim();
    const inputVariables = this._inputVariables
      .map(({label, expression}) => ({label: label.trim(), expression: expression.trim()}))
      .filter(({expression}) => expression.length > 0);

    this.submitEvent.emit({name, inputVariables});
    this.closeModal();
  }

  private updateInputVariablesValidity(): void {
    this.$inputVariablesInvalid.set(
      this._inputVariables.some(
        ({label, expression}) => label.trim().length > 0 && expression.trim().length === 0
      )
    );
  }
}
