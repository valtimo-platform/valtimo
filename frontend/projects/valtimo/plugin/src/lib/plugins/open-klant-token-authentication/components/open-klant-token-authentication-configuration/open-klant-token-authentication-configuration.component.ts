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
import {PluginConfigurationComponent} from '../../../../models';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  Observable,
  Subscription,
  switchMap,
  take,
} from 'rxjs';
import {OpenKlantTokenAuthenticationConfig} from '../../models';

@Component({
  selector: 'valtimo-open-klant-token-authentication-configuration',
  templateUrl: './open-klant-token-authentication-configuration.component.html',
  standalone: false,
})
export class OpenKlantTokenAuthenticationConfigurationComponent
  implements PluginConfigurationComponent, OnInit, OnDestroy
{
  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() pluginId: string;
  @Input() prefillConfiguration$: Observable<OpenKlantTokenAuthenticationConfig>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<OpenKlantTokenAuthenticationConfig> =
    new EventEmitter<OpenKlantTokenAuthenticationConfig>();

  private saveSubscription!: Subscription;

  private readonly formValue$ = new BehaviorSubject<OpenKlantTokenAuthenticationConfig | null>(
    null
  );
  private readonly valid$ = new BehaviorSubject<boolean>(false);

  public ngOnInit(): void {
    this.openSaveSubscription();
  }

  public ngOnDestroy() {
    this.saveSubscription?.unsubscribe();
  }

  public formValueChange(formValue: OpenKlantTokenAuthenticationConfig): void {
    this.formValue$.next(formValue);
    this.handleValid(formValue);
  }

  private handleValid(formValue: OpenKlantTokenAuthenticationConfig): void {
    const valid = !!(formValue.configurationTitle && formValue.token?.length >= 20);

    this.valid$.next(valid);
    this.valid.emit(valid);
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
