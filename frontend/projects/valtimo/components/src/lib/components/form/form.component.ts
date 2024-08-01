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
  AfterContentInit,
  Component,
  ContentChildren,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  QueryList,
} from '@angular/core';
import {InputComponent} from '../input/input.component';
import {combineLatest, of, startWith, Subscription} from 'rxjs';
import {tap} from 'rxjs/operators';
import {FormOutput} from '../../models';
import {SelectComponent} from '../select/select.component';
import {CarbonMultiInputComponent} from '../multi-input/carbon-multi-input.component';
import {DatePickerComponent} from '../date-picker/date-picker.component';
import {MultiInputFormComponent} from '../multi-input-form/multi-input-form.component';
import {RadioComponent} from '../radio/radio.component';
import {ValuePathSelectorComponent} from '../value-path-selector/value-path-selector.component';

@Component({
  selector: 'v-form',
  templateUrl: './form.component.html',
  styleUrls: ['./form.component.scss'],
})
export class FormComponent implements AfterContentInit, OnDestroy {
  @ContentChildren(InputComponent) inputComponents!: QueryList<InputComponent>;
  @ContentChildren(SelectComponent) selectComponents!: QueryList<SelectComponent>;
  @ContentChildren(CarbonMultiInputComponent)
  multiInputComponents!: QueryList<CarbonMultiInputComponent>;
  @ContentChildren(DatePickerComponent) datePickerComponents!: QueryList<DatePickerComponent>;
  @ContentChildren(MultiInputFormComponent)
  multiInputFormComponents!: QueryList<MultiInputFormComponent>;
  @ContentChildren(RadioComponent)
  radioComponents!: QueryList<RadioComponent>;
  @ContentChildren(ValuePathSelectorComponent)
  valuePathSelectorComponents!: QueryList<ValuePathSelectorComponent>;

  @Input() className = '';

  @Output() valueChange: EventEmitter<FormOutput> = new EventEmitter();

  private componentValuesSubscription!: Subscription;
  private changesSubscription!: Subscription;
  private prevValuesObject?: FormOutput = undefined;

  ngAfterContentInit(): void {
    this.openChangesSubscription();
  }

  ngOnDestroy(): void {
    this.closeComponentValuesSubscription();
    this.changesSubscription?.unsubscribe();
  }

  onContentChange(): void {
    this.openComponentValuesSubscription();
  }

  private openComponentValuesSubscription(): void {
    const valueComponents = [
      ...this.inputComponents?.toArray(),
      ...this.selectComponents?.toArray(),
      ...this.multiInputComponents?.toArray(),
      ...this.datePickerComponents?.toArray(),
      ...this.multiInputFormComponents?.toArray(),
      ...this.radioComponents?.toArray(),
      ...this.valuePathSelectorComponents?.toArray(),
    ];

    this.componentValuesSubscription = combineLatest(
      valueComponents.map(component => {
        const inputComponent = component as InputComponent;
        const selectComponent = component as SelectComponent;
        const multiInputComponent = component as CarbonMultiInputComponent;
        const datePickerComponent = component as DatePickerComponent;
        const multiInputFormComponent = component as MultiInputFormComponent;
        const radioComponent = component as RadioComponent;
        const valuePathSelectorComponent = component as ValuePathSelectorComponent;

        if (selectComponent?.selected$) {
          return selectComponent.selected$.asObservable();
        } else if (multiInputComponent?.mappedValues$) {
          return multiInputComponent.mappedValues$;
        } else if (multiInputFormComponent?.mappedValues$) {
          return multiInputFormComponent.mappedValues$;
        } else if (datePickerComponent?.dateValue$) {
          return datePickerComponent.dateValue$;
        } else if (radioComponent?.radioValue$) {
          return radioComponent.radioValue$;
        } else if (inputComponent?.inputValue$) {
          return inputComponent.inputValue$.asObservable();
        } else if (valuePathSelectorComponent?._selectedPath$) {
          return valuePathSelectorComponent._selectedPath$;
        }

        return of(null);
      })
    )
      .pipe(
        tap(inputValues => {
          const valuesObject: FormOutput = {};

          valueComponents.forEach((component, index) => {
            valuesObject[component.name] = inputValues[index];
          });

          if (JSON.stringify(this.prevValuesObject) !== JSON.stringify(inputValues)) {
            this.prevValuesObject = inputValues;
            this.valueChange.emit(valuesObject);
          }
        })
      )
      .subscribe();
  }

  private closeComponentValuesSubscription(): void {
    this.componentValuesSubscription?.unsubscribe();
  }

  private openChangesSubscription(): void {
    this.changesSubscription = combineLatest([
      this.inputComponents.changes.pipe(startWith(null)),
      this.selectComponents.changes.pipe(startWith(null)),
      this.multiInputComponents.changes.pipe(startWith(null)),
      this.datePickerComponents.changes.pipe(startWith(null)),
      this.multiInputFormComponents.changes.pipe(startWith(null)),
      this.radioComponents.changes.pipe(startWith(null)),
      this.valuePathSelectorComponents.changes.pipe(startWith(null)),
    ]).subscribe(() => {
      this.closeComponentValuesSubscription();
      this.openComponentValuesSubscription();
    });
  }
}
