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

import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ButtonModule, InputModule, LayerModule, ModalModule} from 'carbon-components-angular';
import {ValtimoCdsModalDirective} from '@valtimo/components';
import {ExternalPluginHostCreateRequest, ExternalPluginService} from '@valtimo/plugin';

@Component({
  standalone: true,
  selector: 'valtimo-plugin-host-modal',
  templateUrl: './plugin-host-modal.component.html',
  styleUrls: ['./plugin-host-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ReactiveFormsModule,
    ModalModule,
    ButtonModule,
    InputModule,
    LayerModule,
    ValtimoCdsModalDirective,
  ],
})
export class PluginHostModalComponent implements OnChanges {
  @Input() public open = false;

  @Output() public closeEvent = new EventEmitter<void>();
  @Output() public submitEvent = new EventEmitter<ExternalPluginHostCreateRequest>();

  public readonly form = new FormGroup({
    name: new FormControl('', Validators.required),
    baseUrl: new FormControl('', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]),
    secret: new FormControl('', Validators.required),
    gzacCallbackBaseUrl: new FormControl('', [
      Validators.required,
      Validators.pattern(/^https?:\/\/.+/),
    ]),
    eventBrokerAmqpUrl: new FormControl(''),
    eventBrokerExchange: new FormControl(''),
  });

  constructor(private readonly _externalPluginService: ExternalPluginService) {}

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true) {
      this._fetchDefaults();
    }
  }

  public onSubmit(): void {
    if (this.form.invalid) return;
    const value = this.form.value;
    this.submitEvent.emit({
      name: value.name!,
      baseUrl: value.baseUrl!,
      secret: value.secret!,
      gzacCallbackBaseUrl: value.gzacCallbackBaseUrl!,
      eventBrokerAmqpUrl: value.eventBrokerAmqpUrl?.trim() || null,
      eventBrokerExchange: value.eventBrokerExchange?.trim() || null,
    });
    this._resetForm();
  }

  public onClose(): void {
    this.closeEvent.emit();
    this._resetForm();
  }

  private _fetchDefaults(): void {
    this._externalPluginService.getHostDefaults().subscribe(defaults => {
      this.form.patchValue({
        gzacCallbackBaseUrl: defaults.gzacCallbackBaseUrl,
        eventBrokerAmqpUrl: defaults.eventBrokerAmqpUrl,
        eventBrokerExchange: defaults.eventBrokerExchange,
      });
    });
  }

  private _resetForm(): void {
    this.form.reset({
      name: '',
      baseUrl: '',
      secret: '',
      gzacCallbackBaseUrl: '',
      eventBrokerAmqpUrl: '',
      eventBrokerExchange: '',
    });
  }
}
