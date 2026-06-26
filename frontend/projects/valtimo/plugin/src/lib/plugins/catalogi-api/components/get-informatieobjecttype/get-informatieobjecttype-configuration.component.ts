/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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
import {GetInformatieobjecttypeConfig} from '../../models';
import {FunctionConfigurationComponent} from '../../../../models';

@Component({
  standalone: false,
  selector: 'valtimo-get-informatieobjecttype-configuration',
  templateUrl: './get-informatieobjecttype-configuration.component.html',
})
export class GetInformatieobjecttypeConfigurationComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  @Input() public save$: Observable<void>;
  @Input() public disabled$: Observable<boolean>;
  @Input() public pluginId: string;
  @Input() public prefillConfiguration$: Observable<GetInformatieobjecttypeConfig>;
  @Output() public valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() public configuration: EventEmitter<GetInformatieobjecttypeConfig> =
    new EventEmitter<GetInformatieobjecttypeConfig>();

  private _saveSubscription!: Subscription;

  private readonly formValue$ = new BehaviorSubject<GetInformatieobjecttypeConfig | null>(null);
  private readonly valid$ = new BehaviorSubject<boolean>(false);

  public ngOnInit(): void {
    this.openSaveSubscription();
  }

  public ngOnDestroy() {
    this._saveSubscription?.unsubscribe();
  }

  public formValueChange(formValue: GetInformatieobjecttypeConfig): void {
    this.formValue$.next(formValue);
    this.handleValid(formValue);
  }

  private handleValid(formValue: GetInformatieobjecttypeConfig): void {
    const valid = !!(formValue.informatieobjecttype && formValue.processVariable);

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
