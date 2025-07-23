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
import {
  BehaviorSubject,
  combineLatest,
  filter,
  Observable,
  Subscription,
  switchMap,
  take,
} from 'rxjs';
import {CreatePersoonConfig} from '../../models';

@Component({
  standalone: false,
  selector: 'valtimo-create-persoon',
  templateUrl: './create-persoon.component.html',
})
export class CreatePersoonComponent implements FunctionConfigurationComponent, OnInit, OnDestroy {
  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() pluginId: string;
  @Input() prefillConfiguration$: Observable<CreatePersoonConfig>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<CreatePersoonConfig> =
    new EventEmitter<CreatePersoonConfig>();

  private saveSubscription!: Subscription;
  private readonly formValue$ = new BehaviorSubject<CreatePersoonConfig | null>(null);
  private readonly valid$ = new BehaviorSubject<boolean>(false);

  public ngOnInit(): void {
    this.openSaveSubscription();
  }

  public ngOnDestroy(): void {
    this.saveSubscription?.unsubscribe();
  }

  public formValueChange(formValue: CreatePersoonConfig): void {
    this.formValue$.next(formValue);
    this.handleValid(formValue);
  }

  private handleValid(formValue: CreatePersoonConfig): void {
    this.valid$.next(true);
    this.valid.emit(true);
  }

  private openSaveSubscription(): void {
    this.saveSubscription = this.save$
      ?.pipe(
        switchMap(() => combineLatest([this.formValue$, this.valid$])),
        take(1),
        filter(([_, valid]) => valid)
      )
      .subscribe(([formValue]) => this.configuration.emit(formValue));
  }
}
