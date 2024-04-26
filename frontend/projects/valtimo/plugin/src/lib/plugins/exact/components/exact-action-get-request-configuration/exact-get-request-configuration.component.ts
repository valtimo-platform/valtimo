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
import {BehaviorSubject, combineLatest, Observable, Subscription, take} from 'rxjs';
import {FunctionConfigurationComponent} from '../../../../models';
import ExactGetRequestConfiguration from './exact-get-request-configuration';

@Component({
  selector: 'valtimo-exact-get-request-configuration',
  templateUrl: './exact-get-request-configuration.component.html',
})
// The component explicitly implements the PluginConfigurationComponent interface
export class ExactGetRequestConfigurationComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() pluginId: string;
  @Input() prefillConfiguration$: Observable<ExactGetRequestConfiguration>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<ExactGetRequestConfiguration> =
    new EventEmitter<ExactGetRequestConfiguration>();

  private saveSubscription!: Subscription;

  private readonly formValue$ = new BehaviorSubject<ExactGetRequestConfiguration | null>(null);
  private readonly valid$ = new BehaviorSubject<boolean>(false);

  formValues: any = null;

  ngOnInit(): void {
    this.openSaveSubscription();
  }

  ngOnDestroy() {
    this.saveSubscription?.unsubscribe();
  }

  formValueChange(input: any): void {
    const formValue: ExactGetRequestConfiguration = {
      properties: {
        uri: input.uri,
        bean: input.bean,
      },
    };

    this.formValue$.next(formValue);
    this.handleValid(formValue);
  }

  private handleValid(formValue: ExactGetRequestConfiguration): void {
    const valid = !!(formValue.properties.uri || formValue.properties.bean);

    this.valid$.next(valid);
    this.valid.emit(valid);
  }

  private openSaveSubscription(): void {
    this.saveSubscription = this.save$?.subscribe(save => {
      combineLatest([this.formValue$, this.valid$])
        .pipe(take(1))
        .subscribe(([formValue, valid]) => {
          if (valid) {
            this.configuration.emit(formValue);
          }
        });
    });
  }
}
