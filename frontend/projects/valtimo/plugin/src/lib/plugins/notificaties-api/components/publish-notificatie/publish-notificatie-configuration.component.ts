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
import {MultiInputOutput, MultiInputValues} from '@valtimo/components';
import {PublishNotificatieConfig} from '../../models';

@Component({
  standalone: false,
  selector: 'valtimo-publish-notificatie-configuration',
  templateUrl: './publish-notificatie-configuration.component.html',
})
export class PublishNotificatieConfigurationComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() pluginId: string;
  @Input() prefillConfiguration$: Observable<PublishNotificatieConfig>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<PublishNotificatieConfig> =
    new EventEmitter<PublishNotificatieConfig>();

  kenmerkenDefaultValues: MultiInputValues = [];

  private saveSubscription!: Subscription;
  private prefillSubscription!: Subscription;

  private readonly formValue$ = new BehaviorSubject<PublishNotificatieConfig | null>(null);
  private readonly valid$ = new BehaviorSubject<boolean>(false);
  private kenmerken: {[key: string]: string} = {};

  ngOnInit(): void {
    this.openSaveSubscription();
    this.openPrefillSubscription();
  }

  ngOnDestroy() {
    this.saveSubscription?.unsubscribe();
    this.prefillSubscription?.unsubscribe();
  }

  formValueChange(formValue: PublishNotificatieConfig): void {
    this.formValue$.next({...formValue, kenmerken: this.kenmerken});
    this.handleValid(formValue);
  }

  kenmerkenChange(value: MultiInputOutput): void {
    const values = value as MultiInputValues;
    this.kenmerken = values.reduce(
      (acc, curr) => ({
        ...acc,
        ...(!curr.key || !curr.value ? {} : {[curr.key]: curr.value}),
      }),
      {} as {[key: string]: string}
    );
    const currentFormValue = this.formValue$.value;
    if (currentFormValue) {
      this.formValue$.next({...currentFormValue, kenmerken: this.kenmerken});
    }
  }

  private handleValid(formValue: PublishNotificatieConfig): void {
    const valid =
      !!formValue.kanaal &&
      !!formValue.hoofdObject &&
      !!formValue.resource &&
      !!formValue.resourceUrl &&
      !!formValue.actie;

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

  private openPrefillSubscription(): void {
    if (this.prefillConfiguration$) {
      this.prefillSubscription = this.prefillConfiguration$.pipe(take(1)).subscribe(config => {
        if (!config) return;

        this.kenmerken = config.kenmerken ?? {};
        this.kenmerkenDefaultValues = Object.entries(this.kenmerken).map(([key, value]) => ({
          key,
          value,
        }));

        this.formValue$.next({...config, kenmerken: this.kenmerken});
        this.handleValid(config);
      });
    }
  }
}
