/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

import {Component, EventEmitter, HostBinding, Input, Output} from '@angular/core';
import {MultiInputKeyValue} from '../../../../models';
import {CommonModule} from '@angular/common';
import {InputModule} from 'carbon-components-angular';

@Component({
  selector: 'valtimo-single-value',
  templateUrl: './single-value.component.html',
  styleUrls: ['./single-value.component.scss'],
  standalone: true,
  imports: [CommonModule, InputModule],
})
export class SingleValueComponent {
  @Input() public readonly value!: MultiInputKeyValue;
  @Input() @HostBinding('class.--full-width') public readonly fullWidth = false;
  @Input() public readonly disabled = false;

  @Output() public readonly valueChange: EventEmitter<{
    value: MultiInputKeyValue;
    inputValue: string;
  }> = new EventEmitter();

  public onInputChange(inputValue: string): void {
    this.valueChange.emit({value: this.value, inputValue});
  }
}
