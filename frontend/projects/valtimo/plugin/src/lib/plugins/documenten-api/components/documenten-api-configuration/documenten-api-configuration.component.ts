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
import {BehaviorSubject, combineLatest, map, Observable, Subscription, take} from 'rxjs';
import {DocumentenApiConfig} from '../../models';
import {PluginManagementService, PluginTranslationService} from '../../../../services';
import {TranslateService} from '@ngx-translate/core';
import {DocumentenApiService} from '../../services';

@Component({
  selector: 'valtimo-documenten-api-configuration',
  templateUrl: './documenten-api-configuration.component.html',
})
export class DocumentenApiConfigurationComponent
  implements PluginConfigurationComponent, OnInit, OnDestroy
{
  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() pluginId: string;
  @Input() prefillConfiguration$: Observable<DocumentenApiConfig>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<DocumentenApiConfig> =
    new EventEmitter<DocumentenApiConfig>();

  private saveSubscription!: Subscription;

  private readonly formValue$ = new BehaviorSubject<DocumentenApiConfig | null>(null);
  private readonly valid$ = new BehaviorSubject<boolean>(false);

  readonly authenticationPluginSelectItems$: Observable<Array<{id: string; text: string}>> =
    combineLatest([
      this.pluginManagementService.getPluginConfigurationsByCategory(
        'documenten-api-authentication'
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
  readonly apiVersionItems$: Observable<Array<{id: string; text: string}>> =
    this.documentenApiService.getManagementApiAllVersions().pipe(
      map(response =>
        response.versions.map(version => ({
          id: version,
          text: version,
        }))
      )
    );

  constructor(
    private readonly pluginManagementService: PluginManagementService,
    private readonly translateService: TranslateService,
    private readonly pluginTranslationService: PluginTranslationService,
    private readonly documentenApiService: DocumentenApiService
  ) {}

  ngOnInit(): void {
    this.openSaveSubscription();
  }

  ngOnDestroy() {
    this.saveSubscription?.unsubscribe();
  }

  formValueChange(formValue: DocumentenApiConfig): void {
    if (!formValue.apiVersion) {
      formValue.apiVersion = null;
    }
    this.formValue$.next(formValue);
    this.handleValid(formValue);
  }

  private handleValid(formValue: DocumentenApiConfig): void {
    const valid = !!(
      formValue.configurationTitle &&
      formValue.url &&
      formValue.bronorganisatie &&
      formValue.authenticationPluginConfiguration
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
