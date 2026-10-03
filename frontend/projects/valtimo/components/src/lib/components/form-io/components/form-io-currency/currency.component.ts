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

import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {FormControl, FormGroup} from '@angular/forms';
import {FormioCustomComponent} from '../../../../modules';
import Currency from '@tadashi/currency';
import {Subscription} from 'rxjs';

/**
 * Custom formio component for currency number.
 */
@Component({
  selector: 'valtimo-currency',
  templateUrl: './currency.component.html',
  standalone: false,
})
export class FormIoCurrencyComponent
  implements FormioCustomComponent<number>, OnInit, OnChanges, OnDestroy
{
  @ViewChild('currencyElement') currencyElement!: ElementRef<HTMLInputElement>;

  public readonly currencyForm = new FormGroup({
    currencyValue: new FormControl<string>(''),
  });

  private readonly DIGITS = 2;

  private _focused = false;

  private _value: number | null = null;

  public get value(): number | null {
    return this._value;
  }

  @Input() public set value(value: number) {
    this._value = value;

    if (this._focused) {
      this.renderEditableValue();
      return;
    }

    // Rendering only — emitting here would write the rendered value back over the one form.io
    // is about to hand a freshly redrawn component.
    this.currencyForm.setValue(
      {
        currencyValue: Currency.masking(value, this.maskOpts),
      },
      {emitEvent: false}
    );
  }

  @Output() public readonly valueChange = new EventEmitter<number>();

  @Input() public set disabled(value: boolean) {
    if (value) {
      this.currencyForm.disable({emitEvent: false});
    } else {
      this.currencyForm.enable({emitEvent: false});
    }
  }

  @Input() public readonly currencyLocale: string;
  @Input() public readonly currencyCurrency: string;
  @Input() public readonly allowEmptyValue: boolean;

  private readonly _subscriptions = new Subscription();

  private get decimalSeparator(): string {
    return (
      new Intl.NumberFormat(this.currencyLocale || 'nl-NL')
        .formatToParts(1.5)
        .find(part => part.type === 'decimal')?.value ?? ','
    );
  }

  private get maskOpts(): any {
    return {
      empty: this.allowEmptyValue || false,
      locales: this.currencyLocale || 'nl-NL',
      digits: this.DIGITS,
      options: {
        style: 'currency',
        currency: this.currencyCurrency || 'EUR',
      },
    };
  }

  public ngOnInit(): void {
    this._subscriptions.add(
      this.currencyForm.valueChanges.subscribe(() => {
        const typed = this.currencyForm.value.currencyValue ?? '';
        const sanitized = this.sanitize(typed);

        if (sanitized !== typed) this.replaceTypedText(typed, sanitized);

        const value = this.toValue(sanitized);
        this._value = value;
        this.valueChange.emit(value);
      })
    );
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes.currencyLocale || changes.currencyCurrency || changes.allowEmptyValue) {
      this.renderValue();
    }
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onBlur(): void {
    this._focused = false;
    this.renderValue();
  }

  public onFocus(): void {
    this._focused = true;
    this.currencyForm.setValue(
      {currencyValue: this.toEditableText(this._value)},
      {emitEvent: false}
    );
  }

  private renderEditableValue(): void {
    // Leave what is being typed alone when it already is this value, e.g. a trailing separator.
    if (this.toValue(this.sanitize(this.currencyForm.value.currencyValue ?? '')) === this._value) {
      return;
    }

    this.currencyForm.setValue(
      {currencyValue: this.toEditableText(this._value)},
      {emitEvent: false}
    );
  }

  private renderValue(): void {
    if (this._focused) {
      this.renderEditableValue();
      return;
    }

    this.currencyForm.setValue(
      {
        currencyValue:
          typeof this._value === 'number' ? Currency.masking(this._value, this.maskOpts) : '',
      },
      {emitEvent: false}
    );
  }

  private replaceTypedText(typed: string, sanitized: string): void {
    const input = this.currencyElement?.nativeElement;
    const caret = input?.selectionStart ?? typed.length;
    const sanitizedCaret = this.sanitize(typed.slice(0, caret)).length;

    this.currencyForm.setValue({currencyValue: sanitized}, {emitEvent: false});
    input?.setSelectionRange(sanitizedCaret, sanitizedCaret);
  }

  private sanitize(text: string): string {
    const decimalSeparator = this.decimalSeparator;
    let sanitized = '';
    let decimals: number | null = null;

    for (const character of text) {
      if (character >= '0' && character <= '9') {
        if (decimals !== null) {
          if (decimals === this.DIGITS) continue;
          decimals++;
        }
        sanitized += character;
      } else if (character === decimalSeparator && decimals === null) {
        decimals = 0;
        sanitized += character;
      } else if (character === '-' && sanitized === '') {
        sanitized += character;
      }
    }

    return sanitized;
  }

  private toEditableText(value: number | null): string {
    if (typeof value !== 'number' || value === 0) return '';

    const text = Number.isInteger(value) ? `${value}` : value.toFixed(this.DIGITS);
    return text.replace('.', this.decimalSeparator);
  }

  private toValue(sanitized: string): number | null {
    const amount = /\d/.test(sanitized) ? Number(sanitized.replace(this.decimalSeparator, '.')) : 0;

    return amount === 0 && this.allowEmptyValue ? null : amount;
  }
}
