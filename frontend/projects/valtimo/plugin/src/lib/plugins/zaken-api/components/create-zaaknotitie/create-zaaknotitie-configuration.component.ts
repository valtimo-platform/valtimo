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
import {CreateZaakNotitieConfig} from '../../models';
import {ZAAKNOTIFICATIE_STATUSES} from '../../models/zaaknotificatie-statuses';
import {ZAAKNOTIFICATIE_TYPES} from '../../models/zaaknotificatie-types';
import { TEST_IDS } from '@valtimo/shared';

@Component({
  standalone: false,
  selector: 'valtimo-create-zaaknotitie-configuration',
  templateUrl: './create-zaaknotitie-configuration.component.html',
})
export class CreateZaakNotitieConfigurationComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  readonly TEST_IDS = TEST_IDS;

  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() prefillConfiguration$: Observable<CreateZaakNotitieConfig>;
  @Input() pluginId: string;

  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<CreateZaakNotitieConfig> =
    new EventEmitter<CreateZaakNotitieConfig>();

  public readonly statusOptions: string[] = ZAAKNOTIFICATIE_STATUSES
  public readonly notitieTypeOptions: string[] = ZAAKNOTIFICATIE_TYPES

  private readonly _formValue$ = new BehaviorSubject<CreateZaakNotitieConfig | null>(null);
  private readonly _valid$ = new BehaviorSubject<boolean>(false);
  private _saveSubscription!: Subscription;

  public ngOnInit(): void {
    this.openSaveSubscription();
  }

  public ngOnDestroy(): void {
    this._saveSubscription?.unsubscribe();
  }

  public onFormValueChanged(value: CreateZaakNotitieConfig): void {
    this._formValue$.next(value);
    this.handleValid(value);
  }

  private handleValid(formValue: CreateZaakNotitieConfig): void {
    const valid = !!formValue?.onderwerp && !!formValue?.tekst;
    this._valid$.next(valid);
    this.valid.emit(valid);
  }

  private openSaveSubscription(): void {
    this._saveSubscription = this.save$.subscribe(() => {
      combineLatest([this._formValue$, this._valid$])
        .pipe(take(1))
        .subscribe(([formValue, valid]) => {
          if (valid && formValue) {
            this.configuration.emit({
              onderwerp: formValue.onderwerp,
              tekst: formValue.tekst,
              aangemaaktDoor: formValue.aangemaaktDoor,
              notitieType: formValue.notitieType,
              status: formValue.status,
            });
          }
        });
    });
  }
}
