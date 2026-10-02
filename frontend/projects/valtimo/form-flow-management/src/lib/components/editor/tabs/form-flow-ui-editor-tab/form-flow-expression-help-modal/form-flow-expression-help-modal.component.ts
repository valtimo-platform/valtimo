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
import {TranslateModule} from '@ngx-translate/core';
import {ValtimoCdsModalDirective} from '@valtimo/components';
import {FormFlowRegistryDto} from '@valtimo/shared';
import {ButtonModule, ModalModule} from 'carbon-components-angular';
import {FormFlowContextPropertiesComponent} from '../form-flow-context-properties/form-flow-context-properties.component';

/**
 * Explains how SpEL expressions work in a form flow — conditions, action hooks and the data they
 * can access — in a modal, so the editor itself only needs a compact pointer to this help.
 */
@Component({
  standalone: true,
  selector: 'valtimo-form-flow-expression-help-modal',
  templateUrl: './form-flow-expression-help-modal.component.html',
  styleUrls: ['./form-flow-expression-help-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ButtonModule,
    ModalModule,
    ValtimoCdsModalDirective,
    FormFlowContextPropertiesComponent,
  ],
})
export class FormFlowExpressionHelpModalComponent {
  @Input() public open = false;
  @Input() public registry: FormFlowRegistryDto | null = null;

  @Output() public closeEvent = new EventEmitter<void>();
}
