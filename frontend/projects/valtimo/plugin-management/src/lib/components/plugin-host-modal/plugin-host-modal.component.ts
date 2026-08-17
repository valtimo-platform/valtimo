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

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {ButtonModule, ModalModule} from 'carbon-components-angular';
import {ValtimoCdsModalDirective} from '@valtimo/components';
import {ExternalPluginHostCreateRequest, ExternalPluginHostKind} from '@valtimo/plugin';
import {PluginHostConnectionFormComponent} from '../plugin-host-connection-form/plugin-host-connection-form.component';

@Component({
  standalone: true,
  selector: 'valtimo-plugin-host-modal',
  templateUrl: './plugin-host-modal.component.html',
  styleUrls: ['./plugin-host-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ModalModule,
    ButtonModule,
    ValtimoCdsModalDirective,
    PluginHostConnectionFormComponent,
  ],
})
export class PluginHostModalComponent {
  @ViewChild(PluginHostConnectionFormComponent)
  private _connectionForm: PluginHostConnectionFormComponent | undefined;

  @Input() public open = false;
  @Input() public kind: ExternalPluginHostKind = 'PLUGIN_HOST';

  @Output() public closeEvent = new EventEmitter<void>();
  @Output() public submitEvent = new EventEmitter<ExternalPluginHostCreateRequest>();

  public formValid = false;

  public get isApp(): boolean {
    return this.kind === 'APP';
  }

  public onFormValidChange(valid: boolean): void {
    this.formValid = valid;
  }

  public onSubmit(): void {
    const request = this._connectionForm?.buildRequest(this.kind);
    if (!request) return;
    this.submitEvent.emit(request);
    this._connectionForm?.reset();
  }

  public onClose(): void {
    this.closeEvent.emit();
    this._connectionForm?.reset();
  }
}
