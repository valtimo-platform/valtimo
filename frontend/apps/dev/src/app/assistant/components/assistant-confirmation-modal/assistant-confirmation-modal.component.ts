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
  HostListener,
  Input,
  Output,
} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {ValtimoCdsModalDirective} from '@valtimo/components';
import {ButtonModule, LayerModule, ModalModule} from 'carbon-components-angular';
import {ASSISTANT_TEST_IDS} from '../../constants';
import {AssistantPendingAction} from '../../models';

@Component({
  standalone: true,
  selector: 'valtimo-assistant-confirmation-modal',
  templateUrl: './assistant-confirmation-modal.component.html',
  styleUrls: ['./assistant-confirmation-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonModule,
    CommonModule,
    LayerModule,
    ModalModule,
    TranslateModule,
    ValtimoCdsModalDirective,
  ],
})
export class AssistantConfirmationModalComponent {
  @Input() public pendingAction: AssistantPendingAction | null = null;
  @Input() public applying = false;

  @Output() public cancelEvent = new EventEmitter<void>();
  @Output() public confirmEvent = new EventEmitter<void>();

  protected readonly testIds = ASSISTANT_TEST_IDS;

  @HostListener('document:keydown.escape')
  public onClose(): void {
    if (this.pendingAction && !this.applying) this.cancelEvent.emit();
  }
}
