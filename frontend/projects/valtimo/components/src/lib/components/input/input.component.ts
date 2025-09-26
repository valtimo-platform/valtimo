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

import {
  Component,
  EventEmitter,
  HostBinding,
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
  @HostBinding('class.full-width') fullWidthClass = false;

  @Input() public name = '';
  @Input() public type: InputType = 'text';
  @Input() public title = '';
  @Input() public titleTranslationKey = '';
  @Input() public defaultValue = '';
  @Input() public widthPx!: number;
  @Input() public set fullWidth(value: boolean) {
    this.fullWidthClass = value;
  }
  @Input() public margin = false;
  @Input() public smallMargin = false;
  @Input() public disabled = false;
  @Input() public step!: number;
  @Input() public min!: number;
  @Input() public maxLength = 250;
  @Input() public tooltip = '';
  @Input() public required = false;
  @Input() public hideNumberSpinBox = false;
  @Input() public smallLabel = false;
  @Input() public rows!: number;
  @Input() public clear$!: Observable<null>;
  @Input() public carbonTheme = 'g10';
  @Input() public placeholder = '';
  @Input() public dataTestId?: string;

  @Output() public valueChange: EventEmitter<any> = new EventEmitter();

  public inputValue$ = new BehaviorSubject<any>(undefined);

  public isText!: boolean;
  public isTextarea!: boolean;
  public isNumber!: boolean;
  public isPassword!: boolean;
  public isDigitOnly!: boolean;
  public isCheckbox!: boolean;

  public readonly showPassword$ = new BehaviorSubject<boolean>(false);

  private valueSubscription!: Subscription;
  private clearSubscription!: Subscription;

  public ngOnInit(): void {
    this.setInputType();
    this.setDefaultValue(this.defaultValue);
    this.openValueSubscription();
    this.openClearSubscription();
  }

  public onValueChange(value: any): void {
    this.inputValue$.next(value);
  }

  public ngOnChanges(changes: SimpleChanges): void {
    const currentDefaultValue = changes?.defaultValue?.currentValue;

    if (currentDefaultValue) {
      this.setDefaultValue(currentDefaultValue);
    }
  }

  public ngOnDestroy(): void {
    this.valueSubscription?.unsubscribe();
    this.clearSubscription?.unsubscribe();
  }

  public toggleShowPassword(): void {
    this.showPassword$.pipe(take(1)).subscribe(showPassword => {
      this.showPassword$.next(!showPassword);
    });
  }

  public stopCheckboxEventPropagation(event: MouseEvent): void {
    event.stopPropagation();
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
