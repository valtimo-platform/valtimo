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

import {Component, EventEmitter, Input, Output} from '@angular/core';
import {ConnectorProperties} from '@valtimo/config';

/**
 * @deprecated Use the new plugin framework
 */
@Component({
  selector: 'valtimo-edit-connector-form',
  templateUrl: './edit-connector-form.component.html',
  styleUrls: ['./edit-connector-form.component.scss'],
})
export class EditConnectorFormComponent {
  @Input() properties: ConnectorProperties;
  @Input() withDefaults = false;
  @Input() showDeleteButton = false;
  @Input() showSaveButton = true;
  @Input() defaultName!: string;
  @Input() connectorName: string;

  @Output() propertiesSave = new EventEmitter<{properties: ConnectorProperties; name: string}>();
  @Output() connectorDelete = new EventEmitter<any>();

  readonly productAanvragenName = 'ProductAanvragen';
  readonly taakName = 'Taak';
  readonly customConnectorNames = [this.productAanvragenName, this.taakName];
}
