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
  map,
  Observable,
  Subscription,
  switchMap,
  take,
} from 'rxjs';
import {KlantinteractiesApiConfig} from '../../models';
import {PluginManagementService, PluginTranslationService} from '../../../../services';
import {TranslateService} from '@ngx-translate/core';

@Component({
  standalone: false,
  selector: 'valtimo-klantinteracties-api-configuration',
  templateUrl: './klantinteracties-api-configuration.component.html',
})
export class KlantinteractiesApiConfigurationComponent
  implements PluginConfigurationComponent, OnInit, OnDestroy
{
  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() pluginId: string;
  @Input() prefillConfiguration$: Observable<KlantinteractiesApiConfig>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<KlantinteractiesApiConfig> =
    new EventEmitter<KlantinteractiesApiConfig>();

  private saveSubscription!: Subscription;

  private readonly formValue$ = new BehaviorSubject<KlantinteractiesApiConfig | null>(null);
  private readonly valid$ = new BehaviorSubject<boolean>(false);

  readonly authenticationPluginSelectItems$: Observable<Array<{id: string; text: string}>> =
    combineLatest([
      this.pluginManagementService.getPluginConfigurationsByCategory(
        'klantinteracties-api-authentication'
      ),
      this.translateService.stream('key'),
    ]).pipe(
      map(([configurations]) =>
        configurations.map(configuration => ({
          id: configuration.id,
          text: `${configuration.title} - ${this.pluginTranslationService.instant(
            'title',
            configuration.pluginDefinition.key
          )}`,
        }))
      )
    );

  constructor(
    private readonly pluginManagementService: PluginManagementService,
    private readonly translateService: TranslateService,
    private readonly pluginTranslationService: PluginTranslationService
  ) {}

  public ngOnInit(): void {
    this.openSaveSubscription();
  }

  public ngOnDestroy() {
    this.saveSubscription?.unsubscribe();
  }

  public formValueChange(formValue: KlantinteractiesApiConfig): void {
    this.formValue$.next(formValue);
    this.handleValid(formValue);
  }

  private handleValid(formValue: KlantinteractiesApiConfig): void {
    const valid = !!(
      formValue.configurationTitle &&
      formValue.url &&
      formValue.authenticationPluginConfiguration
    );

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
