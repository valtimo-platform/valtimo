import {AfterViewInit, Component, EventEmitter, Input, OnDestroy, Output} from '@angular/core';
import {FormControl, FormGroup, Validators} from '@angular/forms';
import {Subscription} from 'rxjs';
import {FormioCustomComponent} from '../../../modules';
import {currencyValidator} from './currency.validators';

/**
 * Custom formio component for currency number.
 */
@Component({
  selector: 'valtimo-currency',
  templateUrl: './currency.component.html',
})
export class FormIoCurrencyComponent
  implements FormioCustomComponent<any>, AfterViewInit, OnDestroy
{
  @Input() public value: string;
  @Input() public disabled = false;
  @Input() public required = false;
  @Output() public valueChange = new EventEmitter<any>();
  public currencyForm = new FormGroup({
    currency: new FormControl(''),
  });
  private readonly _subscriptions = new Subscription();

  public ngAfterViewInit(): void {
    this.currencyForm.controls.currency.setValue(this.value);
    this.currencyForm.controls.currency.setValidators(
      this.required ? [Validators.required, currencyValidator()] : [currencyValidator()]
    );
    this.currencyForm.controls.currency.updateValueAndValidity();

    if (this.disabled) {
      Object.keys(this.currencyForm.controls).forEach(key => {
        this.currencyForm?.get(key)?.disable();
      });
    }

    this._subscriptions.add(
      this.currencyForm.valueChanges.subscribe(() => {
        this.onValueChange();
      })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  private onValueChange(): void {
    (this.value as any) = this.currencyForm.valid
      ? this.currencyForm.controls.currency.value
      : this.currencyForm.value;
    this.valueChange.emit(this.value);
  }
}
