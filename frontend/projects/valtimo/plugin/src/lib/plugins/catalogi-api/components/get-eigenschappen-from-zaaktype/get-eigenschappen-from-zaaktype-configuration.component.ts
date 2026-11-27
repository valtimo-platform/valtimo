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
import {FunctionConfigurationComponent} from '../../../../models';
import {BehaviorSubject, combineLatest, Observable, Subscription, take} from 'rxjs';
import {GetEigenschappenFromZaaktypeConfig} from '../../models';
import {SelectItem} from '@valtimo/components';

@Component({
  standalone: false,
  selector: 'valtimo-get-eigenschappen-from-zaaktype-configuration',
  templateUrl: './get-eigenschappen-from-zaaktype-configuration.component.html',
})
export class GetEigenschappenFromZaaktypeConfigurationComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() pluginId: string;
  @Input() prefillConfiguration$: Observable<GetEigenschappenFromZaaktypeConfig>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<GetEigenschappenFromZaaktypeConfig> =
    new EventEmitter<GetEigenschappenFromZaaktypeConfig>();

  public readonly statusOptions: Array<SelectItem> = [
    {id: 'alles', text: 'alles'},
    {id: 'concept', text: 'concept'},
    {id: 'definitief', text: 'definitief'},
  ];

  private saveSubscription!: Subscription;

  private readonly formValue$ = new BehaviorSubject<GetEigenschappenFromZaaktypeConfig | null>(
    null
  );
  private readonly valid$ = new BehaviorSubject<boolean>(false);

  ngOnInit(): void {
    this.openSaveSubscription();
  }

  ngOnDestroy() {
    this.saveSubscription?.unsubscribe();
  }

  formValueChange(formValue: GetEigenschappenFromZaaktypeConfig): void {
    this.formValue$.next(formValue);
    this.handleValid(formValue);
  }

  private handleValid(formValue: GetEigenschappenFromZaaktypeConfig): void {
    const valid = !!formValue.processVariable;

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
