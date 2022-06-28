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

import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {MultiInputKeyValue, MultiInputOutput, MultiInputType, MultiInputValues} from '../../models';
import {BehaviorSubject, combineLatest, Observable, Subscription} from 'rxjs';
import {map, take} from 'rxjs/operators';
import {v4 as uuidv4} from 'uuid';

@Component({
  selector: 'v-multi-input',
  templateUrl: './multi-input.component.html',
  styleUrls: ['./multi-input.component.scss'],
})
export class MultiInputComponent implements OnInit, OnDestroy {
  @Input() name = '';
  @Input() title = '';
  @Input() titleTranslationKey = '';
  @Input() type: MultiInputType = 'value';
  @Input() initialAmountOfRows = 1;
  @Input() minimumAmountOfRows = 1;
  @Input() maxRows = 20;
  @Input() addRowText = '';
  @Input() addRowTranslationKey = '';
  @Input() deleteRowText = '';
  @Input() deleteRowTranslationKey = '';

  @Output() valueChange: EventEmitter<MultiInputOutput> = new EventEmitter();

  readonly values$ = new BehaviorSubject<MultiInputValues>(this.getInitialRows());
  readonly mappedValues$: Observable<MultiInputOutput> = this.values$.pipe(
    map(
      values =>
        values
          .map(value => this.getMappedValue(value))
          .filter(value =>
            this.type === 'value'
              ? value
              : (value as MultiInputKeyValue).value && (value as MultiInputKeyValue).key
          ) as MultiInputOutput
    )
  );
  readonly addRowEnabled$: Observable<boolean> = this.values$.pipe(
    map(values => !!(values.length < this.maxRows))
  );

  private valuesSubscription!: Subscription;

  ngOnInit(): void {
    this.openValuesSubscription();
  }

  ngOnDestroy(): void {
    this.valuesSubscription?.unsubscribe();
  }

  addRow(): void {
    combineLatest([this.values$, this.addRowEnabled$])
      .pipe(take(1))
      .subscribe(([values, addRowEnabled]) => {
        if (addRowEnabled) {
          this.values$.next([...values, this.getEmptyValue()]);
        }
      });
  }

  deleteRow(uuid: string): void {
    this.values$.pipe(take(1)).subscribe(values => {
      if (values.length > this.minimumAmountOfRows) {
        this.values$.next(values.filter(value => value.uuid !== uuid));
      }
    });
  }

  trackByFn(index: number, value: MultiInputKeyValue): string {
    return value.uuid as string;
  }

  onValueChange(
    templateValue: MultiInputKeyValue,
    inputValue: string,
    change: 'key' | 'value'
  ): void {
    this.values$.pipe(take(1)).subscribe(values => {
      this.values$.next(
        values.map(stateValue => {
          if (stateValue.uuid === templateValue.uuid) {
            if (change === 'value') {
              return {...stateValue, value: inputValue};
            } else if (change === 'key') {
              return {...stateValue, key: inputValue};
            }
          }
          return stateValue;
        })
      );
    });
  }

  private getInitialRows(): MultiInputValues {
    const minimumRows = this.minimumAmountOfRows;
    const initialRows = this.initialAmountOfRows;
    const amountOfInitalRows =
      minimumRows > initialRows ? minimumRows : initialRows > 1 ? initialRows : 1;
    return new Array(amountOfInitalRows).fill(this.getEmptyValue());
  }

  private getEmptyValue(): MultiInputKeyValue {
    return {
      key: '',
      value: '',
      uuid: uuidv4(),
    };
  }

  private getMappedValue(valueToMap: MultiInputKeyValue): MultiInputKeyValue | string {
    if (this.type === 'keyValue') {
      return {key: valueToMap.key, value: valueToMap.value};
    } else {
      return valueToMap.value;
    }
  }

  private openValuesSubscription(): void {
    this.valuesSubscription = this.mappedValues$.subscribe(values => {
      this.valueChange.emit(values);
    });
  }
}
