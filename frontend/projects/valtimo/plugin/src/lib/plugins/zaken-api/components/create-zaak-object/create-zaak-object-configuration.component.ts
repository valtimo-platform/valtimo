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
import {
  BehaviorSubject,
  combineLatest,
  Observable,
  Subscription,
  take,
} from 'rxjs';
import {PluginTranslatePipe} from '../../../../pipes';
import {SelectItem} from '@valtimo/components';

@Component({
  selector: 'valtimo-create-zaak-object-configuration',
  templateUrl: './create-zaak-object-configuration.component.html',
  providers: [PluginTranslatePipe],
  standalone: false,
})
export class CreateZaakObjectConfigurationComponent implements FunctionConfigurationComponent, OnInit, OnDestroy {
  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() set pluginId(value: string) {
    this.pluginId$.next(value);
  }
  @Input() prefillConfiguration$: Observable<any>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<any> =
    new EventEmitter<any>();

  readonly pluginId$ = new BehaviorSubject<string>('');
  public readonly objectTypeOptions: Array<SelectItem> = [
    { id: 'adres', text: 'adres' },
    { id: 'besluit', text: 'besluit' },
    { id: 'buurt', text: 'buurt' },
    { id: 'enkelvoudig_document', text: 'enkelvoudig_document' },
    { id: 'gemeente', text: 'gemeente' },
    { id: 'gemeentelijke_openbare_ruimte', text: 'gemeentelijke_openbare_ruimte' },
    { id: 'huishouden', text: 'huishouden' },
    { id: 'inrichtingselement', text: 'inrichtingselement' },
    { id: 'kadastrale_onroerende_zaak', text: 'kadastrale_onroerende_zaak' },
    { id: 'kunstwerkdeel', text: 'kunstwerkdeel' },
    { id: 'maatschappelijke_activiteit', text: 'maatschappelijke_activiteit' },
    { id: 'medewerker', text: 'medewerker' },
    { id: 'natuurlijk_persoon', text: 'natuurlijk_persoon' },
    { id: 'niet_natuurlijk_persoon', text: 'niet_natuurlijk_persoon' },
    { id: 'openbare_ruimte', text: 'openbare_ruimte' },
    { id: 'organisatorische_eenheid', text: 'organisatorische_eenheid' },
    { id: 'pand', text: 'pand' },
    { id: 'spoorbaandeel', text: 'spoorbaandeel' },
    { id: 'status', text: 'status' },
    { id: 'terreindeel', text: 'terreindeel' },
    { id: 'terrein_gebouwd_object', text: 'terrein_gebouwd_object' },
    { id: 'vestiging', text: 'vestiging' },
    { id: 'waterdeel', text: 'waterdeel' },
    { id: 'wegdeel', text: 'wegdeel' },
    { id: 'wijk', text: 'wijk' },
    { id: 'woonplaats', text: 'woonplaats' },
    { id: 'woz_deelobject', text: 'woz_deelobject' },
    { id: 'woz_object', text: 'woz_object' },
    { id: 'woz_waarde', text: 'woz_waarde' },
    { id: 'zakelijk_recht', text: 'zakelijk_recht' },
    { id: 'overige', text: 'overige' }
  ];

  private saveSubscription!: Subscription;

  public readonly formValue$ = new BehaviorSubject<any | null>(null);
  private readonly valid$ = new BehaviorSubject<boolean>(false);

  constructor() {}

  ngOnInit(): void {
    this.openSaveSubscription();
  }

  ngOnDestroy() {
    this.saveSubscription?.unsubscribe();
  }

  formValueChange(input: any): void {
    const formValue: any = {
      zaakObjectRequest: {
        object: input.object,
        objectType: input.objectType,
        relatieomschrijving: input.relatieomschrijving,
      }
    };

    if (input.objectType === 'zakelijk_recht') {
      formValue.zaakObjectRequest.objectIdentificatie = {
        identificatie: input.zakelijkRechtIdentificatie,
        avgAard: input.zakelijkRechtAvgAard
      };
    }

    if (input.objectType === 'overige') {
      formValue.zaakObjectRequest.objectTypeOverige = input.objectTypeOverige;
      formValue.zaakObjectRequest.objectTypeOverigeDefinitie = {
        url: input.objectTypeOverigeDefinitieUrl,
        schema: input.objectTypeOverigeDefinitieSchema,
        objectData: input.objectTypeOverigeDefinitieObjectData
      };
    }

    this.formValue$.next(formValue);
    this.handleValid(formValue);
  }

  private handleValid(formValue: any): void {
    let valid = !!formValue.zaakObjectRequest.objectType;

    if (valid && formValue.zaakObjectRequest.objectType === 'overige') {
      valid = !!formValue.zaakObjectRequest.objectTypeOverige;
    }

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
