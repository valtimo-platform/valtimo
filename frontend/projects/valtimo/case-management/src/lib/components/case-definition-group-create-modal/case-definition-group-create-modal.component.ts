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

import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {
  ButtonModule,
  InputModule,
  ModalModule,
  LayerModule,
} from 'carbon-components-angular';
import {ValtimoCdsModalDirective, CARBON_CONSTANTS} from '@valtimo/components';
import {CaseDefinitionGroupManagementService} from '../../services';

@Component({
  standalone: true,
  selector: 'valtimo-case-definition-group-create-modal',
  templateUrl: './case-definition-group-create-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ButtonModule,
    InputModule,
    ModalModule,
    LayerModule,
    ValtimoCdsModalDirective,
  ],
})
export class CaseDefinitionGroupCreateModalComponent {
  @Input() open = false;
  @Output() closeEvent = new EventEmitter<boolean>();

  public formGroup: FormGroup = this.fb.group({
    title: this.fb.control('', Validators.required),
    description: this.fb.control(''),
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly groupService: CaseDefinitionGroupManagementService
  ) {}

  public onCloseModal(created?: boolean): void {
    if (!created) {
      this.closeEvent.emit(false);
      this._resetForm();
      return;
    }

    const {title, description} = this.formGroup.controls;
    this.groupService
      .createGroup({
        title: title.value,
        description: description.value || undefined,
      })
      .subscribe({
        next: () => {
          this.closeEvent.emit(true);
          this._resetForm();
        },
        error: () => {
          this.closeEvent.emit(false);
          this._resetForm();
        },
      });
  }

  private _resetForm(): void {
    setTimeout(() => {
      this.formGroup.reset();
    }, CARBON_CONSTANTS.modalAnimationMs);
  }
}
