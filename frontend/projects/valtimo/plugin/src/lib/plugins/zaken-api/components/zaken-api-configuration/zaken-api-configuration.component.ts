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
import {BehaviorSubject, combineLatest, map, Observable, Subscription, take} from 'rxjs';
import {PluginManagementService, PluginTranslationService} from '../../../../services';
import {TranslateService} from '@ngx-translate/core';
import {ZakenApiConfig} from '../../models';

@Component({
  standalone: false,
  selector: 'valtimo-zaken-api-configuration',
  templateUrl: './zaken-api-configuration.component.html',
  styleUrls: ['./zaken-api-configuration.component.scss'],
})
export class ZakenApiConfigurationComponent
  implements PluginConfigurationComponent, OnInit, OnDestroy
{
  @Input() public save$: Observable<void>;
  @Input() public disabled$: Observable<boolean>;
  @Input() public pluginId: string;
  @Input() public prefillConfiguration$: Observable<ZakenApiConfig>;
  @Output() public valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() public configuration: EventEmitter<ZakenApiConfig> = new EventEmitter<ZakenApiConfig>();

  public readonly authenticationPluginSelectItems$: Observable<Array<{id: string; text: string}>> =
    combineLatest([
      this.pluginManagementService.getPluginConfigurationsByCategory('zaken-api-authentication'),
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
  public readonly noteEventListenerEnabled$ = new BehaviorSubject<boolean>(false);

  private _eventListenerEnabledSubscription!: Subscription;
  private readonly formValue$ = new BehaviorSubject<ZakenApiConfig | null>(null);
  private _saveSubscription!: Subscription;
  private readonly valid$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly pluginManagementService: PluginManagementService,
    private readonly translateService: TranslateService,
    private readonly pluginTranslationService: PluginTranslationService
  ) {}

  public ngOnInit(): void {
    this.initNoteEventListenerEnabled();
    this.openEventListenerEnabledSubscription();
    this.openSaveSubscription();
  }

  public ngOnDestroy() {
    this._saveSubscription?.unsubscribe();
    this._eventListenerEnabledSubscription?.unsubscribe();
  }

  public formValueChange(formValue: ZakenApiConfig): void {
    const formValueIncludingToggle = {
      ...formValue,
      noteEventListenerEnabled: this.noteEventListenerEnabled$.getValue(),
    };
    this.formValue$.next(formValueIncludingToggle);
    this.handleValid(formValueIncludingToggle);
  }

  public onNoteEventListenerEnabledChange(event: any): void {
    this.noteEventListenerEnabled$.next(event);
  }

  private initNoteEventListenerEnabled(): void {
    this.prefillConfiguration$.pipe(take(1)).subscribe(configuration => {
      this.noteEventListenerEnabled$.next(configuration.noteEventListenerEnabled);
    });
  }

  private openEventListenerEnabledSubscription(): void {
    this._eventListenerEnabledSubscription = this.noteEventListenerEnabled$.subscribe(value => {
      this.formValueChange(this.formValue$.getValue());
    });
  }

  private handleValid(formValue: ZakenApiConfig): void {
    const valid = !!(
      formValue.configurationTitle &&
      formValue.url &&
      formValue.authenticationPluginConfiguration &&
      formValue.noteEventListenerEnabled !== null &&
      (formValue.noteEventListenerEnabled === false ||
        (formValue.noteEventListenerEnabled === true && formValue.noteSubject))
    );
    this.valid$.next(valid);
    this.valid.emit(valid);
  }

  private openSaveSubscription(): void {
    this._saveSubscription = this.save$.subscribe(() => {
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
