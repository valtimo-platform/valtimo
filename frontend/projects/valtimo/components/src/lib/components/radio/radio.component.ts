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
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import {BehaviorSubject, Observable, Subscription} from 'rxjs';
import {RadioValue} from '../../models';

@Component({
  selector: 'v-radio',
  templateUrl: './radio.component.html',
  styleUrls: ['./radio.component.scss'],
})
export class RadioComponent implements OnInit, OnChanges, OnDestroy {
  @Input() name = '';
  @Input() title = '';
  @Input() titleTranslationKey = '';
  @Input() defaultValue = '';
  @Input() widthPx!: number;
  @Input() fullWidth = false;
  @Input() margin = false;
  @Input() smallMargin = false;
  @Input() disabled = false;
  @Input() tooltip = '';
  @Input() required = false;
  @Input() smallLabel = false;
  @Input() rows!: number;
  @Input() clear$!: Observable<null>;
  @Input() radioValues: Array<RadioValue> = [];

  @Output() valueChange: EventEmitter<any> = new EventEmitter();

  radioValue$ = new BehaviorSubject<any>(undefined);

  private valueSubscription!: Subscription;
  private clearSubscription!: Subscription;

  ngOnInit(): void {
    this.setDefaultValue(this.defaultValue);
    this.openValueSubscription();
    this.openClearSubscription();
  }

  onValueChange(value: any): void {
    this.radioValue$.next(value);
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

  stopRadioEventPropagation(event: MouseEvent): void {
    event.stopPropagation();
  }

  private setDefaultValue(value: any): void {
    this.radioValue$.next(value);
  }

  private openValueSubscription(): void {
    this.radioValue$.subscribe(value => {
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
