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
  AfterContentInit,
  Component,
  ContentChildren,
  EventEmitter,
  OnDestroy,
  Output,
  QueryList,
} from '@angular/core';
import {InputComponent} from '../input/input.component';
import {combineLatest, of, Subscription} from 'rxjs';
import {tap} from 'rxjs/operators';
import {FormOutput} from '../../models';
import {SelectComponent} from '../select/select.component';
import {MultiInputComponent} from '../multi-input/multi-input.component';

@Component({
  selector: 'v-form',
  templateUrl: './form.component.html',
  styleUrls: ['./form.component.scss'],
})
export class FormComponent implements AfterContentInit, OnDestroy {
  @ContentChildren(InputComponent) inputComponents!: QueryList<InputComponent>;
  @ContentChildren(SelectComponent) selectComponents!: QueryList<SelectComponent>;
  @ContentChildren(MultiInputComponent) multiInputComponents!: QueryList<MultiInputComponent>;

  @Output() valueChange: EventEmitter<FormOutput> = new EventEmitter();

  private componentValuesSubscription!: Subscription;

  ngAfterContentInit(): void {
    const valueComponents = [
      ...this.inputComponents?.toArray(),
      ...this.selectComponents?.toArray(),
      ...this.multiInputComponents?.toArray(),
    ];

    this.componentValuesSubscription = combineLatest(
      valueComponents.map(component => {
        const inputComponent = component as InputComponent;
        const selectComponent = component as SelectComponent;
        const multiInputComponent = component as MultiInputComponent;

        if (inputComponent?.inputValue$) {
          return inputComponent.inputValue$.asObservable();
        } else if (selectComponent?.selected$) {
          return selectComponent.selected$.asObservable();
        } else if (multiInputComponent?.mappedValues$) {
          return multiInputComponent.mappedValues$;
        } else {
          return of(null);
        }
      })
    )
      .pipe(
        tap(inputValues => {
          const valuesObject: FormOutput = {};

          valueComponents.forEach((component, index) => {
            valuesObject[component.name] = inputValues[index];
          });

          this.valueChange.emit(valuesObject);
        })
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.componentValuesSubscription?.unsubscribe();
  }
}
