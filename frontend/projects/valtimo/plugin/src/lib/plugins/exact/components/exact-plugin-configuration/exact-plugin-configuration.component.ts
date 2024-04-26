/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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
import {BehaviorSubject, combineLatest, Observable, Subscription, take} from 'rxjs';
import {ExactPluginService} from '../../exact-plugin.service';
import {ExactPluginConfig} from '../../exact-plugin';

@Component({
  selector: 'valtimo-exact-plugin-configuration',
  templateUrl: './exact-plugin-configuration.component.html',
})
// The component explicitly implements the PluginConfigurationComponent interface
export class ExactPluginConfigurationComponent
  implements PluginConfigurationComponent, OnInit, OnDestroy
{
  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() pluginId: string;
  @Input() prefillConfiguration$: Observable<ExactPluginConfig>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<ExactPluginConfig> = new EventEmitter<ExactPluginConfig>();

  private saveSubscription!: Subscription;
  private readonly formValue$ = new BehaviorSubject<ExactPluginConfig | null>(null);
  private readonly valid$ = new BehaviorSubject<boolean>(false);
  private storageCallbackFun!: (any) => void;

  constructor(private exactPluginService: ExactPluginService) {}

  ngOnInit(): void {
    this.openSaveSubscription();
    this.storageCallbackFun = this.onReceiveToken.bind(this);
    window.addEventListener('storage', this.storageCallbackFun);
  }

  onReceiveToken(event): void {
    if (event.key === 'exactAuthorizationCode') {
      this.formValue$
        .pipe(take(1))
        .subscribe(formValue => {
          this.exchangeAuthorizationCode(formValue, localStorage.getItem('exactAuthorizationCode'));
        })
        .unsubscribe();
    }
  }

  ngOnDestroy() {
    this.saveSubscription?.unsubscribe();
    window.removeEventListener('storage', this.storageCallbackFun);
  }

  exchangeAuthorizationCode(formValue, code): void {
    this.exactPluginService
      .exchangeAuthorizationCode(formValue.clientId, formValue.clientSecret, code)
      .subscribe(response => {
        formValue.accessToken = response.accessToken;
        formValue.accessTokenExpiresOn = response.accessTokenExpiresOn;
        formValue.refreshToken = response.refreshToken;
        formValue.refreshTokenExpiresOn = response.refreshTokenExpiresOn;
        this.formValueChange(formValue);
      });
  }

  formValueChange(formValue: ExactPluginConfig): void {
    this.formValue$.next(formValue);
    this.handleValid(formValue);
  }

  openAuthenticationWindow(): void {
    this.formValue$
      .subscribe((formValue: ExactPluginConfig) => {
        const redirect_url = window.location.origin + '/plugins/exact/redirect';
        window.open(
          `https://start.exactonline.nl/api/oauth2/auth?client_id=${formValue.clientId}&redirect_uri=${redirect_url}&response_type=code&force_login=0`,
          '_blank'
        );
      })
      .unsubscribe();
  }

  private handleValid(formValue: ExactPluginConfig): void {
    const valid = !!(
      formValue.clientId &&
      formValue.clientSecret &&
      formValue.accessToken &&
      formValue.refreshToken
    );

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
