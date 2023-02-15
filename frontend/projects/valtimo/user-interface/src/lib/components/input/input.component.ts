/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import {InputType} from '../../models';
import {BehaviorSubject, Observable, Subscription, take} from 'rxjs';

@Component({
  selector: 'v-input',
  templateUrl: './input.component.html',
  styleUrls: ['./input.component.scss'],
})
export class InputComponent implements OnInit, OnChanges, OnDestroy {
  @Input() name = '';
  @Input() type: InputType = 'text';
  @Input() title = '';
  @Input() titleTranslationKey = '';
  @Input() defaultValue = '';
  @Input() widthPx!: number;
  @Input() fullWidth = false;
  @Input() margin = false;
  @Input() smallMargin = false;
  @Input() disabled = false;
  @Input() step!: number;
  @Input() min!: number;
  @Input() maxLength = 250;
  @Input() tooltip = '';
  @Input() required = false;
  @Input() hideNumberSpinBox = false;
  @Input() smallLabel = false;
  @Input() rows!: number;
  @Input() clear$!: Observable<null>;

  @Output() valueChange: EventEmitter<any> = new EventEmitter();

  inputValue$ = new BehaviorSubject<any>(undefined);

  isText!: boolean;
  isTextarea!: boolean;
  isNumber!: boolean;
  isPassword!: boolean;
  isDigitOnly!: boolean;
  isCheckbox!: boolean;

  readonly showPassword$ = new BehaviorSubject<boolean>(false);

  private valueSubscription!: Subscription;
  private clearSubscription!: Subscription;

  ngOnInit(): void {
    this.setInputType();
    this.setDefaultValue(this.defaultValue);
    this.openValueSubscription();
    this.openClearSubscription();
  }

  onValueChange(value: any): void {
    this.inputValue$.next(value);
  }

  ngOnChanges(changes: SimpleChanges): void {
    const currentDefaultValue = changes?.defaultValue?.currentValue;

    if (currentDefaultValue) {
      this.setDefaultValue(currentDefaultValue);
    }
  }

  ngOnDestroy(): void {
    this.valueSubscription?.unsubscribe();
    this.clearSubscription?.unsubscribe();
  }

  toggleShowPassword(): void {
    this.showPassword$.pipe(take(1)).subscribe(showPassword => {
      this.showPassword$.next(!showPassword);
    });
  }

  private setDefaultValue(value: any): void {
    this.inputValue$.next(value);
  }

  private setInputType(): void {
    switch (this.type) {
      case 'text':
        this.isText = true;
        break;
      case 'textarea':
        this.isTextarea = true;
        break;
      case 'number':
        this.isNumber = true;
        break;
      case 'password':
        this.isPassword = true;
        break;
      case 'digitOnly':
        this.isDigitOnly = true;
        break;
      case 'checkbox':
        this.isCheckbox = true;
        break;
    }
  }

  private openValueSubscription(): void {
    this.inputValue$.subscribe(value => {
      this.valueChange.emit(value);
    });
  }

  private openClearSubscription(): void {
    if (this.clear$) {
      this.clearSubscription = this.clear$.subscribe(() => {
        this.onValueChange('');
      });
    }
  }
}
