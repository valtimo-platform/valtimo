/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
import {FunctionConfigurationComponent} from '../../../../models';
import {BehaviorSubject, combineLatest, Observable, Subscription, take} from 'rxjs';
import {GetBesluitConfig} from '../../models';
import { COMPONENTS_TEST_IDS } from '@valtimo/shared';

@Component({
  selector: 'valtimo-get-besluit-configuration',
  templateUrl: './get-besluit-configuration.component.html',
  standalone: false,
})
export class GetBesluitConfigurationComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  readonly TEST_IDS = {
    COMPONENTS_TEST_IDS: COMPONENTS_TEST_IDS
  };

  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() pluginId: string;
  @Input() prefillConfiguration$: Observable<GetBesluitConfig>;

  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<GetBesluitConfig> = new EventEmitter<GetBesluitConfig>();

  private saveSubscription!: Subscription;
  private readonly formValue$ = new BehaviorSubject<GetBesluitConfig | null>(null);
  private readonly valid$ = new BehaviorSubject<boolean>(false);

  public ngOnInit(): void {
    this.openSaveSubscription();
    this.valid.emit(false);
  }

  public ngOnDestroy(): void {
    this.saveSubscription?.unsubscribe();
  }

  private openSaveSubscription(): void {
    this.saveSubscription = this.save$?.subscribe(() => {
      combineLatest([this.formValue$, this.valid$])
        .pipe(take(1))
        .subscribe(([formValue, valid]) => {
          if (valid) {
            this.configuration.emit(formValue);
          }
        });
    });
  }

  public formValueChange(formValue: GetBesluitConfig): void {
    this.formValue$.next(formValue);
    this.handleValid(formValue);
  }

  private handleValid(formValue: GetBesluitConfig): void {
    const valid = !!formValue?.besluitUrl && !!formValue?.resultProcessVariable;

    this.valid$.next(valid);
    this.valid.emit(valid);
  }
}
