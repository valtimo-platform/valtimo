import {
  AfterViewInit,
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
import {FormioCustomComponent} from '../../../modules';
import Currency from '@tadashi/currency';
import {Subscription} from 'rxjs';

/**
 * Custom formio component for currency number.
 */
@Component({
  selector: 'valtimo-currency',
  templateUrl: './currency.component.html',
})
export class FormIoCurrencyComponent
  implements FormioCustomComponent<number>, OnInit, AfterViewInit, OnChanges, OnDestroy
{
  @ViewChild('currencyElement') currencyElement!: ElementRef<HTMLInputElement>;

  public readonly currencyForm = new FormGroup({
    currencyValue: new FormControl<string>(''),
  });

  private _value: number | null = null;

  public get value(): number | null {
    return this._value;
  }

  @Input() public set value(value: number) {
    this._value = value;
    this.currencyForm.setValue({
      currencyValue: Currency.masking(value, this._currencyInstance.opts.maskOpts),
    });
  }

  @Output() public readonly valueChange = new EventEmitter<number>();

  @Input() public set disabled(value: boolean) {
    if (value) {
      this.currencyForm.disable();
    } else {
      this.currencyForm.enable();
    }
  }

  @Input() public readonly currencyLocale: string;
  @Input() public readonly currencyCurrency: string;
  @Input() public readonly allowEmptyValue: boolean;

  private _currencyInstance!: Currency;

  private readonly _subscriptions = new Subscription();

  public ngOnInit(): void {
    this._subscriptions.add(
      this.currencyForm.valueChanges.subscribe(() => {
        const unmasked = this._currencyInstance.getUnmasked(this.currencyForm.value.currencyValue);

        if (unmasked === 0 && this.allowEmptyValue) {
          this._value = null;
          this.valueChange.emit(null);
        } else {
          this._value = unmasked;
          this.valueChange.emit(unmasked);
        }
      })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public ngAfterViewInit(): void {
    this._currencyInstance = new Currency(this.currencyElement.nativeElement, {
      maskOpts: {
        empty: this.allowEmptyValue || false,
        locales: this.currencyLocale || 'nl-NL',
        digits: 2,
        options: {
          style: 'currency',
          currency: this.currencyCurrency || 'EUR',
        },
      },
    });
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes.currencyLocale || changes.currencyCurrency || changes.allowEmptyValue) {
      if (typeof this.currencyLocale === 'string') {
        this._currencyInstance.opts.maskOpts.locales = this.currencyLocale;
      }

      if (typeof this.currencyCurrency === 'string') {
        this._currencyInstance.opts.maskOpts.options.currency = this.currencyCurrency;
      }

      if (typeof this.allowEmptyValue === 'boolean') {
        this._currencyInstance.opts.maskOpts.empty = this.allowEmptyValue;
      }

      this.currencyForm.setValue({
        currencyValue:
          typeof this._value === 'number'
            ? Currency.masking(this._value, this._currencyInstance.opts.maskOpts)
            : '',
      });
    }
  }
}
