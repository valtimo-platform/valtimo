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
import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {ValtimoCdsModalDirective} from '@valtimo/components';
import {ButtonModule, InputModule, ModalModule} from 'carbon-components-angular';
import {EXTERNAL_PLUGIN_HOST_MODAL_TEST_IDS} from '../../constants';
import {ExternalPluginHostCreateRequest} from '../../models';

@Component({
  standalone: true,
  selector: 'valtimo-external-plugin-host-modal',
  templateUrl: './external-plugin-host-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ReactiveFormsModule,
    ModalModule,
    InputModule,
    ButtonModule,
    ValtimoCdsModalDirective,
  ],
})
export class ExternalPluginHostModalComponent {
  @Input() public open = false;
  @Output() public closeEvent = new EventEmitter<void>();
  @Output() public submitEvent = new EventEmitter<ExternalPluginHostCreateRequest>();

  public readonly form: FormGroup = this.fb.group({
    name: this.fb.control('', Validators.required),
    baseUrl: this.fb.control('', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]),
  });

  protected readonly testIds = EXTERNAL_PLUGIN_HOST_MODAL_TEST_IDS;

  constructor(private readonly fb: FormBuilder) {}

  public onSubmit(): void {
    if (this.form.invalid) return;
    this.submitEvent.emit(this.form.value as ExternalPluginHostCreateRequest);
    this.form.reset({name: '', baseUrl: ''});
  }

  public onClose(): void {
    this.closeEvent.emit();
    this.form.reset({name: '', baseUrl: ''});
  }
}
