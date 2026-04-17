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

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {FunctionConfigurationComponent} from '../../../../models';
import {BehaviorSubject, combineLatest, Observable, Subscription, take} from 'rxjs';
import {GetAuditTrailConfig} from '../../models';

@Component({
  templateUrl: './get-audit-trail-configuration.component.html',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GetAuditTrailConfigurationComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  @Input() public save$: Observable<void>;
  @Input() public disabled$: Observable<boolean>;
  @Input() public pluginId: string;
  @Input() public prefillConfiguration$: Observable<GetAuditTrailConfig>;
  @Output() public valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() public configuration: EventEmitter<GetAuditTrailConfig> =
    new EventEmitter<GetAuditTrailConfig>();

  private _saveSubscription!: Subscription;
  private readonly _formValue$ = new BehaviorSubject<GetAuditTrailConfig | null>(null);
  private readonly _valid$ = new BehaviorSubject<boolean>(false);

  public ngOnInit(): void {
    this.openSaveSubscription();
  }

  public ngOnDestroy(): void {
    this._saveSubscription?.unsubscribe();
  }

  public formValueChange(formValue: GetAuditTrailConfig): void {
    this._formValue$.next(formValue);
    this.handleValid(formValue);
  }

  private handleValid(formValue: GetAuditTrailConfig): void {
    const valid = !!(formValue.documentUrl && formValue.processVariableName);

    this._valid$.next(valid);
    this.valid.emit(valid);
  }

  private openSaveSubscription(): void {
    this._saveSubscription = this.save$?.subscribe(() => {
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
