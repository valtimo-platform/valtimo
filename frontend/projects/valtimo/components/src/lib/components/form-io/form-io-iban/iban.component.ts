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

import {AfterViewInit, Component, EventEmitter, Input, OnDestroy, Output} from '@angular/core';
import {FormControl, FormGroup, Validators} from '@angular/forms';
import {ibanValidator} from './iban.validators';
import {Subscription} from 'rxjs';
import {FormioCustomComponent} from '../../../modules';

/**
 * Custom formio component for iban bank accounts.
 */
@Component({
  selector: 'valtimo-iban',
  templateUrl: './iban.component.html',
  styleUrls: ['./iban.component.scss'],
  standalone: false,
})
export class FormIoIbanComponent implements FormioCustomComponent<any>, AfterViewInit, OnDestroy {
  @Input() public value: string;
  @Input() public disabled = false;
  @Input() public required = false;
  @Output() public valueChange = new EventEmitter<any>();
  public ibanForm = new FormGroup({
    iban: new FormControl(''),
  });
  private readonly _subscriptions = new Subscription();

  public ngAfterViewInit(): void {
    setTimeout(() => {
      this.ibanForm.controls.iban.setValue(this.value);
      this.ibanForm.controls.iban.setValidators(
        this.required ? [Validators.required, ibanValidator()] : [ibanValidator()]
      );
      this.ibanForm.controls.iban.updateValueAndValidity();

      if (this.disabled) {
        Object.keys(this.ibanForm.controls).forEach(key => {
          this.ibanForm?.get(key)?.disable();
        });
      }

      this._subscriptions.add(
        this.ibanForm.valueChanges.subscribe(() => {
          this.onValueChange();
        })
      );
    });
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  private onValueChange(): void {
    (this.value as any) = this.ibanForm.valid
      ? this.ibanForm.controls.iban.value
      : [this.ibanForm.value];
    this.valueChange.emit(this.value);
  }
}
