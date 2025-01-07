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
  OnDestroy,
  OnInit,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import {
  ArbitraryInputTitles,
  ListItemWithId,
  MultiInputChangeEventType,
  MultiInputKeyValue,
  MultiInputOutput,
  MultiInputType,
  MultiInputValues,
  ValuePathSelectorNotation,
  ValuePathSelectorPrefix,
} from '../../models';
import {BehaviorSubject, combineLatest, Observable, Subscription} from 'rxjs';
import {map, take} from 'rxjs/operators';
import {v4 as uuidv4} from 'uuid';

@Component({
  selector: 'valtimo-carbon-multi-input',
  templateUrl: './carbon-multi-input.component.html',
  styleUrls: ['./carbon-multi-input.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class CarbonMultiInputComponent implements OnInit, OnDestroy {
  @Input() public addRowText = '';
  @Input() public addRowTranslationKey = '';
  @Input() public arbitraryAmountTitles!: ArbitraryInputTitles;
  @Input() public set arbitraryValueAmount(value: number) {
    this._amountOfArbitraryValues = value;
    this.amountOfArbitraryValuesArray$.next(this.getArrayOfXLength(value));
  }
  @Input() public defaultValues!: MultiInputValues;
  @Input() public deleteRowText = '';
  @Input() public deleteRowTranslationKey = '';
  @Input() public disabled = false;
  @Input() public dropdownColumnTitle = '';
  @Input() public set dropdownItems(value: Array<ListItemWithId>) {
    this.dropdownItems$.next(value);
  }
  @Input() public dropdownWidth = 250;
  @Input() public fullWidth = false;
  @Input() public hideAddButton = false;
  @Input() public hideDeleteButton = false;
  @Input() public initialAmountOfRows = 1;
  @Input() public keyColumnTitle = '';
  @Input() public margin = false;
  @Input() public maxRows = null;
  @Input() public minimumAmountOfRows = 1;
  @Input() public name = '';
  @Input() public required = false;
  @Input() public title = '';
  @Input() public titleTranslationKey = '';
  @Input() public tooltip = '';
  @Input() public type: MultiInputType = 'value';
  @Input() public valueColumnTitle = '';

  @Input() public readonly valuePathSelectorDocumentDefinitionName = '';
  @Input() public readonly valuePathSelectorPrefixes: ValuePathSelectorPrefix[] = [];
  @Input() public readonly valuePathSelectorShowDocumentDefinitionSelector = false;
  @Input() public readonly valuePathSelectorNotation: ValuePathSelectorNotation = 'dots';

  @Input() public readonly keyColumnFlex = 1;
  @Input() public readonly dropdownColumnFlex = 1;
  @Input() public readonly valueColumnFlex = 1;

  @Output() public valueChange: EventEmitter<MultiInputOutput> = new EventEmitter();
  @Output() public allValuesValidEvent: EventEmitter<boolean> = new EventEmitter();

  private _amountOfArbitraryValues!: number;
  public readonly amountOfArbitraryValuesArray$ = new BehaviorSubject<Array<0>>([]);

  public readonly values$ = new BehaviorSubject<MultiInputValues>([]);
  public readonly mappedValues$: Observable<MultiInputOutput> = this.values$.pipe(
    map(values => this.filterAndMapValues(values))
  );
  public readonly addRowEnabled$: Observable<boolean> = this.values$.pipe(
    map(values => !!(this.maxRows === null || values.length < this.maxRows))
  );

  public readonly dropdownItems$ = new BehaviorSubject<Array<ListItemWithId>>([]);

  private readonly _subscriptions = new Subscription();

  public ngOnInit(): void {
    this.values$.next(this.getInitialRows());
    this.openValuesSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public addRow(): void {
    combineLatest([this.values$, this.addRowEnabled$])
      .pipe(take(1))
      .subscribe(([values, addRowEnabled]) => {
        if (addRowEnabled) {
          this.values$.next([...values, this.getEmptyValue()]);
        }
      });
  }

  public deleteRow(uuid: string): void {
    this.values$.pipe(take(1)).subscribe(values => {
      if (values.length > this.minimumAmountOfRows) {
        this.values$.next(values.filter(value => value.uuid !== uuid));
      }
    });
  }

  public trackByFn(_: number, value: MultiInputKeyValue): string {
    return value.uuid as string;
  }

  public getDropdownItemsForRow(index: number): Observable<Array<ListItemWithId>> {
    return combineLatest([this.dropdownItems$, this.values$]).pipe(
      map(([dropdownItems, values]) => {
        const defaultValue = values[index] || this.defaultValues[index];

        return dropdownItems.map(dropdownItem => ({
          ...dropdownItem,
          selected: defaultValue ? dropdownItem.id === defaultValue.dropdown : false,
        }));
      })
    );
  }

  public onValueChange(
    templateValue: MultiInputKeyValue,
    inputValue: string,
    change: MultiInputChangeEventType,
    arbitraryIndex?: number
  ): void {
    this.values$.pipe(take(1)).subscribe(values => {
      this.values$.next(
        values.map(stateValue => {
          if (stateValue.uuid === templateValue.uuid) {
            if (change === 'value') {
              return {...stateValue, value: inputValue};
            } else if (change === 'key') {
              return {...stateValue, key: inputValue};
            } else if (change === 'dropdown') {
              return {...stateValue, dropdown: inputValue};
            } else if (change === 'arbitrary') {
              return {...stateValue, [arbitraryIndex]: inputValue};
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
    const amountOfInitialRows = Math.max(minimumRows, initialRows);

    if (!this.defaultValues) {
      return new Array(amountOfInitialRows).fill(this.getEmptyValue());
    }

    return this.defaultValues.map(defaultValue => ({...defaultValue, uuid: uuidv4()}));
  }

  private getEmptyValue(): MultiInputKeyValue {
    if (this.type === 'arbitraryAmount') {
      const emptyValue = {
        uuid: uuidv4(),
      };

      this.getArrayOfXLength(this._amountOfArbitraryValues).forEach((_, index) => {
        emptyValue[`${index}`] = '';
      });

      return emptyValue;
    }

    return {
      key: '',
      value: '',
      uuid: uuidv4(),
      dropdown: '',
    };
  }

  private getMappedValue(valueToMap: MultiInputKeyValue): MultiInputKeyValue | string {
    if (this.type === 'keyValue' || this.type === 'keyValuePathSelector') {
      return {key: valueToMap.key, value: valueToMap.value};
    } else if (this.type === 'keyDropdownValue' || this.type === 'valuePathSelectorDropdownValue') {
      return {key: valueToMap.key, value: valueToMap.value, dropdown: valueToMap.dropdown};
    } else if (this.type === 'arbitraryAmount') {
      const objCopy = {...valueToMap};
      delete objCopy.uuid;
      return objCopy;
    }

    return valueToMap.value;
  }

  private openValuesSubscription(): void {
    this._subscriptions.add(
      combineLatest([this.values$, this.mappedValues$]).subscribe(([values, mappedValues]) => {
        this.valueChange.emit(mappedValues);
        this.allValuesValidEvent.emit(values.length === mappedValues.length);
      })
    );
  }

  private getArrayOfXLength(length: number): 0[] {
    return Array(length).fill(0);
  }

  private filterAndMapValues(values: MultiInputValues): MultiInputOutput {
    return values
      .map(value => this.getMappedValue(value))
      .filter(value => this.isValueValid(value)) as MultiInputOutput;
  }

  private isValueValid(value: MultiInputKeyValue | string): boolean {
    switch (this.type) {
      case 'value':
        return !!value;
      case 'keyValue':
      case 'keyValuePathSelector':
        return !!((value as MultiInputKeyValue).value || (value as MultiInputKeyValue).key);
      case 'keyDropdownValue':
      case 'valuePathSelectorDropdownValue':
        return !!(
          (value as MultiInputKeyValue).value &&
          (value as MultiInputKeyValue).key &&
          (value as MultiInputKeyValue).dropdown
        );
      case 'arbitraryAmount':
        const objectValues = Object.values(value as MultiInputKeyValue);
        const positiveValuesAmount = objectValues.filter(objectValue => !!objectValue);
        return objectValues.length === positiveValuesAmount.length;
      default:
        return false;
    }
  }
}
