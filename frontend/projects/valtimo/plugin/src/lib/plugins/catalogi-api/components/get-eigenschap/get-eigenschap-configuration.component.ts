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
import {GetEigenschapConfig} from '../../models';
import {FunctionConfigurationComponent} from '../../../../models';

@Component({
  standalone: false,
  selector: 'valtimo-get-eigenschap-configuration',
  templateUrl: './get-eigenschap-configuration.component.html',
  styleUrls: ['./get-eigenschap-configuration.component.scss'],
})
export class GetEigenschapConfigurationComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  @Input() public save$: Observable<void>;
  @Input() public disabled$: Observable<boolean>;
  @Input() public pluginId: string;
  @Input() public prefillConfiguration$: Observable<GetEigenschapConfig>;
  @Output() public valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() public configuration: EventEmitter<GetEigenschapConfig> =
    new EventEmitter<GetEigenschapConfig>();

  private _saveSubscription!: Subscription;

  private readonly formValue$ = new BehaviorSubject<GetEigenschapConfig | null>(null);
  private readonly valid$ = new BehaviorSubject<boolean>(false);

  public ngOnInit(): void {
    this.openSaveSubscription();
  }

  public ngOnDestroy() {
    this._saveSubscription?.unsubscribe();
  }

  public formValueChange(formValue: GetEigenschapConfig): void {
    this.formValue$.next(formValue);
    this.handleValid(formValue);
  }

  private handleValid(formValue: GetEigenschapConfig): void {
    const valid = !!(formValue.eigenschap && formValue.processVariable);

    this.valid$.next(valid);
    this.valid.emit(valid);
  }

  private openSaveSubscription(): void {
    this._saveSubscription = this.save$?.subscribe(save => {
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
