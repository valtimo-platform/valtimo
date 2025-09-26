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

import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {ConnectorPropertyEditField, ConnectorPropertyValueType} from '@valtimo/config';
import {BehaviorSubject, combineLatest, Subscription} from 'rxjs';
import {map, take} from 'rxjs/operators';

/**
 * @deprecated Use the new plugin framework
 */
@Component({
  selector: 'valtimo-multi-value-connector-property',
  templateUrl: './multi-value-connector-property.component.html',
  styleUrls: ['./multi-value-connector-property.component.scss'],
})
export class MultiValueConnectorPropertyComponent implements OnInit, OnDestroy {
  @Input() editField: ConnectorPropertyEditField;
  @Input() disabled!: boolean;
  @Input() defaultValue!: ConnectorPropertyValueType;

  @Output() valuesSet = new EventEmitter<{editFieldKey: string; values: Array<string | number>}>();

  readonly amountOfValues$ = new BehaviorSubject<Array<null>>([null]);

  readonly removeButtonDisabled$ = this.amountOfValues$.pipe(
    map(amountOfValues => amountOfValues.length === 1)
  );

  readonly values$ = new BehaviorSubject<{[key: number]: number | string}>({});

  readonly addButtonDisabled$ = combineLatest([this.values$, this.amountOfValues$]).pipe(
    map(([values, amountOfValues]) => {
      const objectValues = Object.values(values);
      const validObjectValues = objectValues.filter(value => value === 0 || value);

      return amountOfValues.length !== validObjectValues.length;
    })
  );

  private valuesSubscription!: Subscription;

  ngOnInit(): void {
    this.openValuesSubscription();
    this.setDefaults();
  }

  ngOnDestroy(): void {
    this.valuesSubscription?.unsubscribe();
  }

  onValueChange(
    value: string | number,
    editField: ConnectorPropertyEditField,
    index: number
  ): void {
    this.values$.pipe(take(1)).subscribe(values => {
      this.values$.next({
        ...values,
        [index]:
          editField.editType === 'string[]'
            ? (value as string).trim()
            : parseInt(value as string, 10),
      });
    });
  }

  addRow(): void {
    this.amountOfValues$.pipe(take(1)).subscribe(amountOfValues => {
      this.amountOfValues$.next([...amountOfValues, null]);
    });
  }

  removeRow(): void {
    combineLatest([this.values$, this.amountOfValues$])
      .pipe(take(1))
      .subscribe(([values, amountOfValues]) => {
        const lastValueIndex = amountOfValues.length - 1;
        const valuesCopy = {...values};

        delete valuesCopy[lastValueIndex];

        this.values$.next(valuesCopy);
        this.amountOfValues$.next(amountOfValues.filter((curr, index) => index !== lastValueIndex));
      });
  }

  private openValuesSubscription(): void {
    this.valuesSubscription = this.values$.subscribe(values => {
      this.valuesSet.emit({
        editFieldKey: this.editField.key,
        values: Object.values(values).filter(value => value === 0 || value),
      });
    });
  }

  private setDefaults(): void {
    const defaultValue = this.defaultValue as Array<any>;
    const validValues =
      Array.isArray(defaultValue) && defaultValue.filter(value => value === 0 || value);

    if (validValues && validValues.length > 0) {
      const valuesObject = {};

      validValues.forEach((value, index) => {
        valuesObject[index] = value;
      });

      this.values$.next(valuesObject);
      this.amountOfValues$.next(validValues.map(() => null));
    }
  }
}
