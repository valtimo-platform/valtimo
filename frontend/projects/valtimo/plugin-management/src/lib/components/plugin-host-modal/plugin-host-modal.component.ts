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
import {TranslateModule} from '@ngx-translate/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ButtonModule, ModalModule} from 'carbon-components-angular';
import {ValtimoCdsModalDirective} from '@valtimo/components';
import {ExternalPluginHostCreateRequest} from '../../models';

@Component({
  standalone: true,
  selector: 'valtimo-plugin-host-modal',
  templateUrl: './plugin-host-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ReactiveFormsModule,
    ModalModule,
    ButtonModule,
    ValtimoCdsModalDirective,
  ],
})
export class PluginHostModalComponent {
  @Input() public open = false;

  @Output() public closeEvent = new EventEmitter<void>();
  @Output() public submitEvent = new EventEmitter<ExternalPluginHostCreateRequest>();

  public readonly form = new FormGroup({
    name: new FormControl('', Validators.required),
    baseUrl: new FormControl('', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]),
    secret: new FormControl('', Validators.required),
  });

  public onSubmit(): void {
    if (this.form.invalid) return;
    this.submitEvent.emit(this.form.value as ExternalPluginHostCreateRequest);
    this.form.reset({name: '', baseUrl: '', secret: ''});
  }

  public onClose(): void {
    this.closeEvent.emit();
    this.form.reset({name: '', baseUrl: '', secret: ''});
  }
}
