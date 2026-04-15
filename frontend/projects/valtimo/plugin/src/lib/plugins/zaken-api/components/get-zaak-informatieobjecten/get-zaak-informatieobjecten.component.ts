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
import {BehaviorSubject, combineLatest, map, Observable, Subscription, take, tap, withLatestFrom} from 'rxjs';
import {PluginManagementService, PluginTranslationService} from '../../../../services';
import {TranslateService} from '@ngx-translate/core';
import {GetZaakInformatieobjectenConfig} from '../../models';

@Component({
  selector: 'valtimo-get-zaak-informatieobjecten-configuration',
  templateUrl: './get-zaak-informatieobjecten.component.html',
})
export class GetZaakInformatieobjectenComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() pluginId: string;
  @Input() prefillConfiguration$: Observable<GetZaakInformatieobjectenConfig>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<GetZaakInformatieobjectenConfig> =
    new EventEmitter<GetZaakInformatieobjectenConfig>();

  private saveSubscription!: Subscription;

  private readonly formValue$ = new BehaviorSubject<GetZaakInformatieobjectenConfig | null>(null);
  private readonly valid$ = new BehaviorSubject<boolean>(false);

  readonly authenticationPluginSelectItems$: Observable<Array<{id: string; text: string}>> =
    combineLatest([
      this.pluginManagementService.getPluginConfigurationsByCategory('get-zaak-informatieobjecten'),
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

  public ngOnDestroy(): void {
    this.saveSubscription?.unsubscribe();
  }

  public formValueChange(formValue: GetZaakInformatieobjectenConfig): void {
    this.formValue$.next(formValue);
    this.handleValid(formValue);
  }

  private handleValid(formValue: GetZaakInformatieobjectenConfig): void {
    const valid = !!formValue.resultProcessVariable;

    this.valid$.next(valid);
    this.valid.emit(valid);
  }

  private openSaveSubscription(): void {
    this.saveSubscription = this.save$
      .pipe(
        withLatestFrom(this.formValue$, this.valid$),
        map(([_, formValue, valid]) => valid ? formValue : null),
        tap(formValue => {
          if (formValue) this.configuration.emit(formValue);
        })
      )
      .subscribe();
  }
}
