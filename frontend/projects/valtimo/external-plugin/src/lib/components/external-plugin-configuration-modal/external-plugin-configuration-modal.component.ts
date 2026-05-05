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
import {ButtonModule, DropdownModule, InputModule, ModalModule} from 'carbon-components-angular';
import {EXTERNAL_PLUGIN_CONFIGURATION_MODAL_TEST_IDS} from '../../constants';
import {ExternalPluginConfigurationCreateRequest, ExternalPluginDefinition} from '../../models';

@Component({
  standalone: true,
  selector: 'valtimo-external-plugin-configuration-modal',
  templateUrl: './external-plugin-configuration-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ReactiveFormsModule,
    ModalModule,
    InputModule,
    ButtonModule,
    DropdownModule,
    ValtimoCdsModalDirective,
  ],
})
export class ExternalPluginConfigurationModalComponent {
  @Input() public open = false;
  @Input() public definitions: Array<ExternalPluginDefinition> = [];
  @Output() public closeEvent = new EventEmitter<void>();
  @Output() public submitEvent = new EventEmitter<ExternalPluginConfigurationCreateRequest>();

  public readonly form: FormGroup = this.fb.group({
    definitionId: this.fb.control<string | null>(null, Validators.required),
    title: this.fb.control('', Validators.required),
    propertiesJson: this.fb.control('{}', Validators.required),
  });

  public propertiesError: string | null = null;

  protected readonly testIds = EXTERNAL_PLUGIN_CONFIGURATION_MODAL_TEST_IDS;

  constructor(private readonly fb: FormBuilder) {}

  public onSubmit(): void {
    if (this.form.invalid) return;
    let parsedProperties: Record<string, unknown>;
    try {
      parsedProperties = JSON.parse(this.form.value.propertiesJson ?? '{}');
    } catch {
      this.propertiesError = 'externalPlugin.configuration.propertiesInvalidJson';
      return;
    }
    this.propertiesError = null;
    const request: ExternalPluginConfigurationCreateRequest = {
      definitionId: this.form.value.definitionId,
      title: this.form.value.title,
      properties: parsedProperties,
    };
    this.submitEvent.emit(request);
    this.form.reset({definitionId: null, title: '', propertiesJson: '{}'});
  }

  public onClose(): void {
    this.closeEvent.emit();
    this.form.reset({definitionId: null, title: '', propertiesJson: '{}'});
    this.propertiesError = null;
  }
}
