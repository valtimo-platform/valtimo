/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {FormBuilder, Validators} from '@angular/forms';
import {FormFlowDefinition} from '../../models';
import {CARBON_CONSTANTS} from '@valtimo/components';

@Component({
  selector: 'valtimo-new-form-flow-modal',
  templateUrl: './new-form-flow-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewFormFlowModalComponent {
  @Input() open = false;
  @Output() closeEvent = new EventEmitter<FormFlowDefinition | null>();

  public form = this.fb.group({
    key: this.fb.control('', Validators.required),
  });

  public get key() {
    return this.form?.get('key');
  }

  constructor(private readonly fb: FormBuilder) {}

  public onCancel(): void {
    this.closeEvent.emit(null);
    this.resetForm();
  }

  public onConfirm(): void {
    if (!this.key) {
      return;
    }

    this.closeEvent.emit({
      key: this.key.value,
      version: 1,
      startStep: 'start-step',
      steps: [],
    });
    this.resetForm();
  }

  private resetForm(): void {
    setTimeout(() => {
      this.form.reset();
    }, CARBON_CONSTANTS.modalAnimationMs);
  }
}
