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
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {FormioCustomComponent} from '../../../../modules';
import AutoNumeric from 'autonumeric';

const DEFAULT_LOCALE = 'nl-NL';
const DEFAULT_CURRENCY = 'EUR';
const RAW_VALUE_MODIFIED_EVENT = 'autoNumeric:rawValueModified';

/**
 * Custom formio component for currency number.
 */
@Component({
  selector: 'valtimo-currency',
  templateUrl: './currency.component.html',
  standalone: false,
})
export class FormIoCurrencyComponent
  implements FormioCustomComponent<number>, AfterViewInit, OnChanges, OnDestroy
{
  @ViewChild('currencyElement') currencyElement!: ElementRef<HTMLInputElement>;

  private _value: number | null = null;

  public get value(): number | null {
    return this._value;
  }

  @Input() public set value(value: number) {
    this._value = typeof value === 'number' ? value : null;
    this.renderValue();
  }

  @Output() public readonly valueChange = new EventEmitter<number>();

  private _disabled = false;

  public get disabled(): boolean {
    return this._disabled;
  }

  @Input() public set disabled(value: boolean) {
    this._disabled = !!value;
  }

  @Input() public readonly currencyLocale: string;
  @Input() public readonly currencyCurrency: string;
  @Input() public readonly allowEmptyValue: boolean;

  private _autoNumeric: AutoNumeric | null = null;

  private _rendering = false;

  private readonly _rawValueModifiedListener = (): void => this.onRawValueModified();

  public ngAfterViewInit(): void {
    const element = this.currencyElement.nativeElement;

    this._autoNumeric = new AutoNumeric(element, this.autoNumericOptions);
    element.addEventListener(RAW_VALUE_MODIFIED_EVENT, this._rawValueModifiedListener);

    this.renderValue();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (
      this._autoNumeric &&
      (changes.currencyLocale || changes.currencyCurrency || changes.allowEmptyValue)
    ) {
      this.withoutEmitting(() => this._autoNumeric.update(this.autoNumericOptions));
      this.renderValue();
    }
  }

  public ngOnDestroy(): void {
    if (!this._autoNumeric) {
      return;
    }

    this.currencyElement.nativeElement.removeEventListener(
      RAW_VALUE_MODIFIED_EVENT,
      this._rawValueModifiedListener
    );
    this._autoNumeric.remove();
    this._autoNumeric = null;
  }

  /**
   * Derives the AutoNumeric formatting from the Intl formatting of the configured locale and
   * currency, so the input renders amounts exactly as that locale writes them.
   */
  private get autoNumericOptions(): AutoNumeric.Options {
    const formatter = new Intl.NumberFormat(this.currencyLocale || DEFAULT_LOCALE, {
      style: 'currency',
      currency: this.currencyCurrency || DEFAULT_CURRENCY,
    });

    const parts = formatter.formatToParts(-1234567.89);
    const partValue = (type: Intl.NumberFormatPartTypes): string =>
      parts.find(part => part.type === type)?.value ?? '';
    const indexOf = (type: Intl.NumberFormatPartTypes): number =>
      parts.findIndex(part => part.type === type);

    const currencyIndex = indexOf('currency');
    const firstIntegerIndex = indexOf('integer');
    const minusSignIndex = indexOf('minusSign');
    const currencyIsPrefix = currencyIndex < firstIntegerIndex;

    const spacing = parts[currencyIsPrefix ? currencyIndex + 1 : currencyIndex - 1];
    const literal = spacing?.type === 'literal' ? spacing.value : '';
    const currencySymbol = currencyIsPrefix
      ? `${partValue('currency')}${literal}`
      : `${literal}${partValue('currency')}`;

    const negativePositiveSignPlacement = currencyIsPrefix
      ? minusSignIndex < currencyIndex
        ? 'l'
        : 'r'
      : minusSignIndex < firstIntegerIndex
        ? 'p'
        : minusSignIndex < currencyIndex
          ? 'l'
          : 's';

    return {
      currencySymbol,
      currencySymbolPlacement: currencyIsPrefix ? 'p' : 's',
      negativePositiveSignPlacement,
      digitGroupSeparator: partValue('group'),
      decimalCharacter: partValue('decimal') || '.',
      decimalPlaces: formatter.resolvedOptions().maximumFractionDigits,
      emptyInputBehavior: 'always',
      modifyValueOnWheel: false,
    };
  }

  private onRawValueModified(): void {
    if (this._rendering || !this._autoNumeric) {
      return;
    }

    const numericString = this._autoNumeric.getNumericString();
    const isEmpty = numericString === null || numericString === '';
    const value = isEmpty ? (this.allowEmptyValue ? null : 0) : Number(numericString);

    this._value = value;
    this.valueChange.emit(value);
  }

  private renderValue(): void {
    if (!this._autoNumeric) {
      return;
    }

    this.withoutEmitting(() => {
      if (typeof this._value === 'number') {
        this._autoNumeric.set(this._value);
      } else {
        this._autoNumeric.clear();
      }
    });
  }

  private withoutEmitting(action: () => void): void {
    this._rendering = true;
    try {
      action();
    } finally {
      this._rendering = false;
    }
  }
}
