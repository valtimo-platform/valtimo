/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.See the License for the specific language governing permissions and limitations under the License.
 */

import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {PluginConfigurationComponent, PluginConfigurationData} from '../../../../models';
import {BehaviorSubject, combineLatest, Observable, Subscription} from 'rxjs';
import {map, switchMap, tap} from 'rxjs/operators';
import {ZaakType} from '@valtimo/resource';

@Component({
  selector: 'valtimo-create-zaak-configuration',
  templateUrl: './create-zaak-configuration.component.html',
  styleUrls: ['./create-zaak-configuration.component.scss'],
})
export class CreateZaakConfigurationComponent
  implements PluginConfigurationComponent, OnInit, OnDestroy
{
  @Input() clear$: Observable<void>;
  @Input() save$: Observable<void>;
  @Input() disabled: boolean;
  @Input() error: boolean;
  @Input() pluginId: string;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<PluginConfigurationData> =
    new EventEmitter<PluginConfigurationData>();

  readonly selectedZaakType$ = new BehaviorSubject<ZaakType | null>(null);

  private validSubscription!: Subscription;

  ngOnInit(): void {
    this.openValidSubscription();
  }

  ngOnDestroy(): void {
    this.validSubscription?.unsubscribe();
  }

  selectZaakType(zaakType: ZaakType | null): void {
    this.selectedZaakType$.next(zaakType);
  }

  private openValidSubscription(): void {
    this.validSubscription = combineLatest([this.selectedZaakType$])
      .pipe(
        tap(([zaakType]) => {
          if (zaakType) {
            this.valid.emit(true);
          } else {
            this.valid.emit(false);
          }
        })
      )
      .subscribe();
  }
}
