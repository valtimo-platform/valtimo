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

import {Component, EventEmitter, Input, Output} from '@angular/core';
import {PluginConfigurationComponent, PluginConfigurationData} from '../../../../models';
import {BehaviorSubject, combineLatest, Observable, of} from 'rxjs';
import {map, switchMap, tap} from 'rxjs/operators';
import {OpenZaakService, ZaakType, ZaakTypeLink} from '@valtimo/resource';
import {PluginTranslationService} from '../../../../services';
import {SelectItem, ModalService, SelectItemId} from '@valtimo/user-interface';

@Component({
  selector: 'valtimo-select-zaak-type',
  templateUrl: './select-zaak-type.component.html',
  styleUrls: ['./select-zaak-type.component.scss'],
})
export class SelectZaakTypeComponent {
  @Input() pluginId: string;
  @Input() disabled: boolean;
  @Output() zaakTypeSelected = new EventEmitter<ZaakType | null>();

  zaakTypeLinks$: Observable<Array<ZaakTypeLink> | null> = this.modalService.modalData$.pipe(
    switchMap(modalData => {
      if (modalData?.processDefinitionKey) {
        return this.openZaakService.getZaakTypeLinkListByProcess(modalData?.processDefinitionKey);
      } else {
        return of(null);
      }
    })
  );

  zaakTypeLinkSelectItems$: Observable<Array<SelectItem> | null> = this.zaakTypeLinks$.pipe(
    map(zaakTypeLinks =>
      zaakTypeLinks?.map(link => ({
        id: link.zaakTypeUrl,
        text: link.documentDefinitionName,
      }))
    )
  );

  private readonly selectedZaakTypeUrl$ = new BehaviorSubject<string>('');

  readonly selectedZaakType$: Observable<ZaakType | null> = combineLatest([
    this.selectedZaakTypeUrl$,
    this.openZaakService.getZaakTypes(),
  ]).pipe(
    map(([selectedZaakTypeUrl, zaakTypes]) =>
      zaakTypes.find(zaakType => zaakType.url === selectedZaakTypeUrl)
    ),
    tap(selectedZaakType => this.zaakTypeSelected.emit(selectedZaakType))
  );

  constructor(
    private readonly openZaakService: OpenZaakService,
    private readonly modalService: ModalService,
    private readonly pluginTranslationService: PluginTranslationService
  ) {}

  selectZaakTypeLink(zaakTypeUrl: SelectItemId): void {
    this.selectedZaakTypeUrl$.next(zaakTypeUrl as string);
  }
}
