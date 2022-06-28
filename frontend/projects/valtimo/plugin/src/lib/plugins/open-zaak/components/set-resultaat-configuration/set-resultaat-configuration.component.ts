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
import {BehaviorSubject, combineLatest, Observable, Subject, Subscription} from 'rxjs';
import {SelectItem} from '@valtimo/user-interface';
import {ZaakType} from '@valtimo/resource';
import {tap} from 'rxjs/operators';

@Component({
  selector: 'valtimo-set-resultaat-configuration',
  templateUrl: './set-resultaat-configuration.component.html',
  styleUrls: ['./set-resultaat-configuration.component.scss'],
})
export class SetResultaatConfigurationComponent
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

  private readonly selectedResultaat$ = new BehaviorSubject<string>('');

  readonly selectedZaakType$ = new BehaviorSubject<ZaakType | null>(null);

  readonly RESULTATEN: Array<string> = [
    'Ingetrokken',
    'Ongegrond met financ',
    'Gegrond met financië',
    'Informeel afgehandel',
    'Niet ontvankelijk ve',
    'Gegrond met invloed',
    'Ongegrond',
    'Afgebroken',
    'Gegrond',
  ];

  readonly resultaatSelectItems: Array<SelectItem> = this.RESULTATEN.map(resultaat => ({
    id: resultaat,
    text: resultaat,
  }));

  readonly clearSubject$ = new Subject();

  private validSubscription!: Subscription;

  ngOnInit(): void {
    this.openValidSubscription();
  }

  ngOnDestroy(): void {
    this.validSubscription?.unsubscribe();
  }

  selectZaakType(zaakType: ZaakType | null): void {
    this.selectedZaakType$.next(zaakType);

    if (!zaakType) {
      this.clearResultaat();
    }
  }

  clearResultaat(): void {
    this.selectedResultaat$.next('');
    this.clearSubject$.next(null);
  }

  selectResultaat(resultaat: string): void {
    this.selectedResultaat$.next(resultaat);
  }

  private openValidSubscription(): void {
    this.validSubscription = combineLatest([this.selectedResultaat$, this.selectedZaakType$])
      .pipe(
        tap(([resultaat, zaakType]) => {
          if (resultaat && zaakType) {
            this.valid.emit(true);
          } else {
            this.valid.emit(false);
          }
        })
      )
      .subscribe();
  }
}
