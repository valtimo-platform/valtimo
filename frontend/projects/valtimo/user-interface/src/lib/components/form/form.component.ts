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
import {combineLatest, Subscription} from 'rxjs';
import {tap} from 'rxjs/operators';
import {FormOutput} from '../../models';

@Component({
  selector: 'v-form',
  templateUrl: './form.component.html',
  styleUrls: ['./form.component.scss'],
})
export class FormComponent implements AfterContentInit, OnDestroy {
  @ContentChildren(InputComponent) inputComponents!: QueryList<InputComponent>;

  @Output() valueChange: EventEmitter<FormOutput> = new EventEmitter();

  private inputComponentsValueSubscription!: Subscription;

  ngAfterContentInit(): void {
    this.inputComponentsValueSubscription = combineLatest(
      this.inputComponents.map(component => component.inputValue$.asObservable())
    )
      .pipe(
        tap(inputValues => {
          const valuesObject: FormOutput = {};

          this.inputComponents.forEach((component, index) => {
            valuesObject[component.name] = inputValues[index];
          });

          this.valueChange.emit(valuesObject);
        })
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.inputComponentsValueSubscription?.unsubscribe();
  }
}
