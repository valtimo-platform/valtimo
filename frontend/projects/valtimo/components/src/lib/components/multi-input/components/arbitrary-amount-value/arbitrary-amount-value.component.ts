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

import {Component, EventEmitter, HostBinding, Input, Output} from '@angular/core';
import {
  ArbitraryInputTitles,
  MultiInputChangeEventType,
  MultiInputKeyValue,
} from '../../../../models';
import {CommonModule} from '@angular/common';
import {InputModule} from 'carbon-components-angular';
import {Observable} from 'rxjs';

@Component({
  selector: 'valtimo-arbitrary-amount-value',
  templateUrl: './arbitrary-amount-value.component.html',
  styleUrls: ['./arbitrary-amount-value.component.scss'],
  standalone: true,
  imports: [CommonModule, InputModule],
})
export class ArbitraryAmountValueComponent {
  @Input() public readonly index!: number;
  @Input() public readonly value!: MultiInputKeyValue;
  @Input() public readonly fullWidth = false;
  @Input() public readonly disabled = false;
  @Input() public readonly arbitraryAmountTitles!: ArbitraryInputTitles;
  @Input() public readonly amountOfArbitraryValuesArray$!: Observable<0[]>;

  @Output() public readonly valueChange: EventEmitter<{
    value: MultiInputKeyValue;
    inputValue: string;
    type: MultiInputChangeEventType;
    arbitraryIndex: number;
  }> = new EventEmitter();

  @HostBinding('class.--full-width') get isFullWidth(): boolean {
    return this.fullWidth;
  }

  public onInputChange(arbitraryIndex: number, inputValue: string): void {
    this.valueChange.emit({
      value: this.value,
      inputValue,
      type: 'arbitrary',
      arbitraryIndex,
    });
  }
}
