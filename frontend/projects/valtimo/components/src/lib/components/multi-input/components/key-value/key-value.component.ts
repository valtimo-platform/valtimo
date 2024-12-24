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
 * WITHimport { LabelModule } from 'carbon-components-angular';
OUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Component, EventEmitter, HostBinding, Input, Output} from '@angular/core';
import {MultiInputChangeEventType, MultiInputKeyValue} from '../../../../models';
import {CommonModule} from '@angular/common';
import {InputModule} from 'carbon-components-angular';

@Component({
  selector: 'valtimo-key-value',
  templateUrl: './key-value.component.html',
  styleUrls: ['key-value.component.scss'],
  standalone: true,
  imports: [CommonModule, InputModule],
})
export class KeyValueComponent {
  @Input() public readonly keyColumnTitle!: string;
  @Input() public readonly valueColumnTitle!: string;
  @Input() public readonly index!: number;
  @Input() public readonly value!: MultiInputKeyValue;
  @Input() @HostBinding('class.--full-width') public readonly fullWidth = false;
  @Input() public readonly disabled = false;

  @Output() public readonly valueChange: EventEmitter<{
    value: MultiInputKeyValue;
    inputValue: string;
    type: MultiInputChangeEventType;
  }> = new EventEmitter();

  public onInputChange(type: MultiInputChangeEventType, inputValue: string): void {
    this.valueChange.emit({value: this.value, inputValue, type});
  }
}
