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
import ExactPostRequestConfiguration from './exact-post-request-configuration';

@Component({
  selector: 'valtimo-exact-post-request-configuration',
  templateUrl: './exact-post-request-configuration.component.html',
})
// The component explicitly implements the PluginConfigurationComponent interface
export class ExactPostRequestConfigurationComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() pluginId: string;
  @Input() prefillConfiguration$: Observable<ExactPostRequestConfiguration>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<ExactPostRequestConfiguration> =
    new EventEmitter<ExactPostRequestConfiguration>();

  private saveSubscription!: Subscription;

  private readonly formValue$ = new BehaviorSubject<ExactPostRequestConfiguration | null>(null);
  private readonly valid$ = new BehaviorSubject<boolean>(false);

  formValues: any = null;

  ngOnInit(): void {
    this.openSaveSubscription();
  }

  ngOnDestroy() {
    this.saveSubscription?.unsubscribe();
  }

  formValueChange(input: any): void {
    const formValue: ExactPostRequestConfiguration = {
      properties: {
        uri: input.uri,
        content: input.content,
        bean: input.bean,
      },
    };

    this.formValue$.next(formValue);
    this.handleValid(formValue);
  }

  private handleValid(formValue: ExactPostRequestConfiguration): void {
    const valid = !!(
      (formValue.properties.uri && formValue.properties.content) ||
      formValue.properties.bean
    );

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
