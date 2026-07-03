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
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {IconModule, IconService} from 'carbon-components-angular';
import {Search16, Close16} from '@carbon/icons';

interface TextSegment {
  text: string;
  isFieldName: boolean;
  isInvalid: boolean;
}

@Component({
  standalone: true,
  selector: 'valtimo-search-input-with-validation',
  templateUrl: './search-input-with-validation.component.html',
  styleUrls: ['./search-input-with-validation.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, IconModule],
})
export class SearchInputWithValidationComponent {
  @ViewChild('inputElement') private readonly _inputElement: ElementRef<HTMLInputElement>;

  @Input() public value = '';
  @Input() public invalidFields: string[] = [];
  @Input() public placeholder = '';
  @Input() public expandable = true;

  @Output() public readonly valueChangeEvent = new EventEmitter<string>();
  @Output() public readonly searchEvent = new EventEmitter<string>();

  public isExpanded = false;

  constructor(private readonly _iconService: IconService) {
    this._iconService.registerAll([Search16, Close16]);
  }

  public get segments(): TextSegment[] {
    return this._parseIntoSegments(this.value, this.invalidFields);
  }

  public get hasInvalidFields(): boolean {
    return this.invalidFields.length > 0;
  }

  public onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.value = input.value;
    this.valueChangeEvent.emit(this.value);
  }

  public onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.searchEvent.emit(this.value);
    }
  }

  public onClear(): void {
    this.value = '';
    this.valueChangeEvent.emit(this.value);
    this.searchEvent.emit(this.value);
  }

  public onExpand(): void {
    this.isExpanded = true;
    setTimeout(() => this._inputElement?.nativeElement?.focus(), 0);
  }

  public onBlur(): void {
    if (!this.value) {
      this.isExpanded = false;
    }
  }

  private _parseIntoSegments(text: string, invalidFields: string[]): TextSegment[] {
    if (!text) return [];

    const segments: TextSegment[] = [];
    const fieldPattern = /(\w+(?:\.\w+)*):("([^"]+)"|(\S+))/g;
    const invalidSet = new Set(invalidFields.map(f => f.toLowerCase()));

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = fieldPattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({
          text: text.substring(lastIndex, match.index),
          isFieldName: false,
          isInvalid: false,
        });
      }

      const fieldName = match[1];
      const isInvalid = invalidSet.has(fieldName.toLowerCase());

      segments.push({
        text: fieldName,
        isFieldName: true,
        isInvalid,
      });

      const colonAndValue = match[0].substring(fieldName.length);
      segments.push({
        text: colonAndValue,
        isFieldName: false,
        isInvalid: false,
      });

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      segments.push({
        text: text.substring(lastIndex),
        isFieldName: false,
        isInvalid: false,
      });
    }

    return segments;
  }
}
