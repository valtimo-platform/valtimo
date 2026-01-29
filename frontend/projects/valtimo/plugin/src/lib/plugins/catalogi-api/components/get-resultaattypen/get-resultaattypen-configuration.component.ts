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
import {BehaviorSubject, combineLatest, Observable, Subscription, take} from 'rxjs';
import {FunctionConfigurationComponent} from '../../../../models';
import {GetResultaattypenConfig} from '../../models';
import { TEST_IDS } from '@valtimo/shared';

@Component({
  standalone: false,
  selector: 'valtimo-get-resultaattypen-configuration',
  templateUrl: './get-resultaattypen-configuration.component.html',
})
export class GetResultaattypenConfigurationComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  readonly TEST_IDS = TEST_IDS;

  @Input() disabled$: Observable<boolean>;
  @Input() pluginId: string;
  @Input() prefillConfiguration$: Observable<GetResultaattypenConfig>;
  @Input() save$: Observable<void>;
  @Output() configuration: EventEmitter<GetResultaattypenConfig> =
    new EventEmitter<GetResultaattypenConfig>();
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();

  private readonly _formValue$ = new BehaviorSubject<GetResultaattypenConfig | null>(null);
  private _saveSubscription!: Subscription;
  private readonly _valid$ = new BehaviorSubject<boolean>(false);

  public ngOnInit(): void {
    this.openSaveSubscription();
  }

  public ngOnDestroy(): void {
    this._saveSubscription?.unsubscribe();
  }

  public formValueChange(formValue: GetResultaattypenConfig): void {
    this._formValue$.next(formValue);
    this.handleValid(formValue);
  }

  private handleValid(formValue: GetResultaattypenConfig): void {
    const valid = !!formValue.processVariable;

    this._valid$.next(valid);
    this.valid.emit(valid);
  }

  private openSaveSubscription(): void {
    this._saveSubscription = this.save$?.subscribe(save => {
      combineLatest([this._formValue$, this._valid$])
        .pipe(take(1))
        .subscribe(([formValue, valid]) => {
          if (valid) {
            this.configuration.emit(formValue);
          }
        });
    });
  }
}
