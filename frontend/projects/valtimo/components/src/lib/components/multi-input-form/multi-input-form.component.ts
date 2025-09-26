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
  TemplateRef,
} from '@angular/core';
import {FormOutput, MultiInputFormsValues, MultiInputFormValue, MultiInputType} from '../../models';
import {BehaviorSubject, combineLatest, Observable, Subscription} from 'rxjs';
import {map, take} from 'rxjs/operators';
import {v4 as uuidv4} from 'uuid';

@Component({
  selector: 'v-multi-input-form',
  templateUrl: './multi-input-form.component.html',
  styleUrls: ['./multi-input-form.component.scss'],
})
export class MultiInputFormComponent implements OnInit, OnChanges, OnDestroy {
  @Input() name = '';
  @Input() title = '';
  @Input() titleTranslationKey = '';
  @Input() type: MultiInputType = 'value';
  @Input() initialAmountOfRows = 1;
  @Input() minimumAmountOfRows = 1;
  @Input() maxRows = null;
  @Input() addRowText = '';
  @Input() addRowTranslationKey = '';
  @Input() deleteRowText = '';
  @Input() deleteRowTranslationKey = '';
  @Input() disabled = false;
  @Input() defaultValues!: Array<FormOutput>;
  @Input() margin = false;
  @Input() tooltip = '';
  @Input() required = false;
  @Input() formTemplate!: TemplateRef<any>;
  @Output() valueChange: EventEmitter<Array<FormOutput>> = new EventEmitter();
  @Output() deleteRowEvent: EventEmitter<string> = new EventEmitter();

  readonly values$ = new BehaviorSubject<MultiInputFormsValues>([]);

  readonly mappedValues$: Observable<Array<FormOutput>> = this.values$.pipe(
    map(values => values.map(value => value.value))
  );

  readonly addRowEnabled$: Observable<boolean> = this.values$.pipe(
    map(values => !!(this.maxRows === null || values.length < this.maxRows))
  );

  public initialDefaultValues$ = new BehaviorSubject<MultiInputFormsValues>([]);

  private valuesSubscription!: Subscription;

  ngOnInit(): void {
    const initialValues = this.getInitialRows();
    this.initialDefaultValues$.next(initialValues);
    this.values$.next(initialValues);
    this.openValuesSubscription();
  }

  ngOnChanges(): void {
    const initialValues = this.getInitialRows();
    this.initialDefaultValues$.next(initialValues);
    this.values$.next(initialValues);
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
          const newValues = [
            ...values?.map(value => ({...value, expanded: false})),
            this.getEmptyValue(),
          ];
          this.values$.next(newValues);
        }
      });
  }

  deleteRow(uuid: string): void {
    this.values$.pipe(take(1)).subscribe(values => {
      if (values.length > this.minimumAmountOfRows) {
        this.deleteRowEvent.emit(uuid);

        this.values$.next(values.filter(value => value.uuid !== uuid));
      }
    });
  }

  toggleRow(uuid: string, expanded: boolean): void {
    if (expanded) {
      this.collapseRow(uuid);
    } else {
      this.expandRow(uuid);
    }
  }

  expandRow(uuid: string): void {
    this.values$.pipe(take(1)).subscribe(values => {
      this.values$.next(
        values.map(value =>
          value.uuid === uuid ? {...value, expanded: true} : {...value, expanded: false}
        )
      );
    });
  }

  collapseRow(uuid: string): void {
    this.values$.pipe(take(1)).subscribe(values => {
      this.values$.next(
        values.map(value => (value.uuid === uuid ? {...value, expanded: false} : value))
      );
    });
  }

  trackByFn(index: number, value: MultiInputFormValue): string {
    return `${value.uuid}`;
  }

  formValueChange = (newValue: FormOutput, rowUuid: string): void => {
    const currentValues = this.values$.getValue();
    const newValues: MultiInputFormsValues = [];

    currentValues.forEach(value => {
      if (value.uuid === rowUuid) {
        newValues.push({uuid: value.uuid, value: newValue, expanded: value.expanded});
      } else {
        newValues.push(value);
      }
    });

    this.values$.next(newValues);
  };

  getFirstValue(rowValue: MultiInputFormValue): string {
    const formValue = rowValue.value as any;
    const firstKey = Object.keys(formValue)[0];
    const firstValue: string = formValue[firstKey];
    return firstValue ? `${firstValue}` : '-';
  }

  private getInitialRows(): MultiInputFormsValues {
    const minimumRows = this.minimumAmountOfRows;
    const initialRows = this.initialAmountOfRows;
    const amountOfInitalRows =
      minimumRows > initialRows ? minimumRows : initialRows > 1 ? initialRows : 0;
    const fillArray = new Array(amountOfInitalRows);

    if (this.defaultValues) {
      return this.defaultValues.map(defaultValue => ({
        value: defaultValue,
        uuid: uuidv4(),
        expanded: false,
      }));
    }

    return fillArray
      .fill(this.getEmptyValue())
      .map((row, index) =>
        index + 1 === fillArray.length ? {...row, expanded: true} : {...row, expanded: false}
      );
  }

  private getEmptyValue(): MultiInputFormValue {
    return {
      expanded: true,
      value: {},
      uuid: uuidv4(),
    };
  }

  private openValuesSubscription(): void {
    this.valuesSubscription?.unsubscribe();
    this.valuesSubscription = this.values$.subscribe(values => {
      this.valueChange.emit(values);
    });
  }
}
