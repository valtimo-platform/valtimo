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
import {FunctionConfigurationComponent} from '../../../../models';
import {GetInformatieobjecttypenConfig} from '../../models';

@Component({
  standalone: false,
  selector: 'valtimo-get-informatieobjecttypen-configuration',
  templateUrl: './get-informatieobjecttypen-configuration.component.html',
})
export class GetInformatieobjecttypenConfigurationComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  @Input() disabled$: Observable<boolean>;
  @Input() pluginId: string;
  @Input() prefillConfiguration$: Observable<GetInformatieobjecttypenConfig>;
  @Input() save$: Observable<void>;
  @Output() configuration: EventEmitter<GetInformatieobjecttypenConfig> =
    new EventEmitter<GetInformatieobjecttypenConfig>();
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();

  private readonly _formValue$ = new BehaviorSubject<GetInformatieobjecttypenConfig | null>(null);
  private _saveSubscription!: Subscription;
  private readonly _valid$ = new BehaviorSubject<boolean>(false);

  public ngOnInit(): void {
    this.openSaveSubscription();
  }

  public ngOnDestroy(): void {
    this._saveSubscription?.unsubscribe();
  }

  public formValueChange(formValue: GetInformatieobjecttypenConfig): void {
    this._formValue$.next(formValue);
    this.handleValid(formValue);
  }

  private handleValid(formValue: GetInformatieobjecttypenConfig): void {
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
