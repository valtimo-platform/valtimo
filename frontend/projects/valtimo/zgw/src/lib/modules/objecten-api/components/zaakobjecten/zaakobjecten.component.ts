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

import {Component, ViewChild} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {ZaakobjectenService} from '../../services';
import {BehaviorSubject, combineLatest, map, Observable, of, switchMap} from 'rxjs';
import {ZaakObject, ZaakObjectType} from '../../models';
import {
  FormIoModule,
  InputLabelModule,
  ModalService,
  ParagraphModule,
  SelectItem,
  SelectModule,
  TableColumn,
  TableModule,
  TitleModule,
  VModalComponent,
  VModalModule,
} from '@valtimo/components';
import {take} from 'rxjs/operators';
import {FormioForm} from '@formio/angular';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';

@Component({
  selector: 'valtimo-dossier-detail-tab-zaakobjecten',
  templateUrl: './zaakobjecten.component.html',
  styleUrls: ['./zaakobjecten.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    SelectModule,
    InputLabelModule,
    ParagraphModule,
    TableModule,
    VModalModule,
    TitleModule,
    FormIoModule,
    TranslateModule,
  ],
})
export class DossierDetailTabZaakobjectenComponent {
  @ViewChild('viewZaakobjectModal') viewZaakobjectModal: VModalComponent;

  private readonly documentId$ = this.route.params.pipe(map(params => params.documentId));

  private readonly objecttypes$: Observable<Array<ZaakObjectType>> = this.documentId$.pipe(
    switchMap(documentId => this.zaakobjectenService.getDocumentObjectTypes(documentId))
  );

  readonly objecttypeSelectItems$: Observable<Array<SelectItem>> = this.objecttypes$.pipe(
    map(objecttypes => objecttypes.map(type => ({id: type.url, text: type.name || '-'})))
  );

  readonly selectedObjecttypeUrl$ = new BehaviorSubject<string | null>(null);

  readonly objects$: Observable<Array<ZaakObject> | null> = combineLatest([
    this.documentId$,
    this.selectedObjecttypeUrl$,
  ]).pipe(
    switchMap(([documentId, selectedObjecttypeUrl]) =>
      documentId && selectedObjecttypeUrl
        ? this.zaakobjectenService
            .getDocumentObjectsOfType(documentId, selectedObjecttypeUrl)
            .pipe(map(objects => objects.map(object => ({...object, title: object.title || '-'}))))
        : of(null)
    )
  );

  readonly columns$ = new BehaviorSubject<Array<TableColumn>>([
    {
      labelTranslationKey: 'dossier.zaakobjecten.index',
      dataKey: 'index',
    },
    {
      labelTranslationKey: 'dossier.zaakobjecten.registrationAt',
      dataKey: 'registrationAt',
    },
    {
      labelTranslationKey: 'dossier.zaakobjecten.title',
      dataKey: 'title',
    },
  ]);

  readonly objectForm$ = new BehaviorSubject<FormioForm | null>(null);

  readonly objectName$ = new BehaviorSubject<string>('');

  readonly noFormDefinitionComponent$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly zaakobjectenService: ZaakobjectenService,
    private readonly modalService: ModalService
  ) {}

  selectObjectType(objectTypeUrl: string): void {
    this.selectedObjecttypeUrl$.next(objectTypeUrl);
  }

  rowClicked(object: ZaakObject, objectTypeSelectItems: Array<SelectItem>): void {
    this.documentId$.pipe(take(1)).subscribe(documentId => {
      this.zaakobjectenService.getObjectTypeForm(documentId, object.url).subscribe(
        res => {
          const definition = res.formDefinition;

          definition.components = definition.components.map(component => ({
            ...component,
            disabled: true,
          }));

          this.setModalData(objectTypeSelectItems, definition);
        },
        () => {
          this.setModalData(objectTypeSelectItems);
        }
      );
    });
  }

  hide(): void {
    this.modalService.closeModal(() => {
      this.objectName$.next('');
      this.objectForm$.next(null);
    });
  }

  private show(): void {
    this.modalService.openModal(this.viewZaakobjectModal);
  }

  private getObjectTypeName(objectTypeSelectItems: Array<SelectItem>): string {
    const selectedObjectTypeUrl = this.selectedObjecttypeUrl$.getValue();
    const currentTypeSelectItem = objectTypeSelectItems.find(
      selectItem => selectItem.id === selectedObjectTypeUrl
    );

    return currentTypeSelectItem.text;
  }

  private setModalData(objectTypeSelectItems: Array<SelectItem>, definition?: FormioForm): void {
    if (definition) {
      this.objectForm$.next(definition);
      this.noFormDefinitionComponent$.next(false);
    } else {
      this.noFormDefinitionComponent$.next(true);
    }

    this.objectName$.next(this.getObjectTypeName(objectTypeSelectItems));
    this.show();
  }
}
