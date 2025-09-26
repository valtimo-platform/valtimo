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
import {BehaviorSubject, combineLatest, map, Observable, of, switchMap, tap} from 'rxjs';
import {ZaakObject, ZaakObjectType} from '../../models';
import {
  FormIoModule,
  ModalService,
  ParagraphModule,
  TableColumn,
  TableModule,
  TitleModule,
  VModalComponent,
  VModalModule,
} from '@valtimo/components';
import {take} from 'rxjs/operators';
import {FormioForm} from '@formio/angular';
import {CommonModule} from '@angular/common';

@Component({
  selector: 'valtimo-object-type',
  templateUrl: './object-type.component.html',
  styleUrls: ['./object-type.component.scss'],
  standalone: true,
  imports: [CommonModule, TableModule, ParagraphModule, VModalModule, TitleModule, FormIoModule],
})
export class DossierDetailTabObjectTypeComponent {
  @ViewChild('viewObjectModal') viewObjectModal: VModalComponent;

  private readonly documentId$ = this.route.params.pipe(map(params => params.documentId));

  private readonly objecttypes$: Observable<Array<ZaakObjectType>> = this.documentId$.pipe(
    switchMap(documentId => this.zaakobjectenService.getDocumentObjectTypes(documentId))
  );

  readonly objectName$ = this.route.params.pipe(
    map(() => {
      const currentUrl = window.location.href;
      const splitUrl = currentUrl.split('/');
      const lastUrlPart = splitUrl[splitUrl.length - 1];

      return lastUrlPart;
    })
  );

  readonly selectedObjecttypeUrl$: Observable<string> = combineLatest([
    this.objecttypes$,
    this.objectName$,
  ]).pipe(
    map(([objectTypes, objectName]) => {
      const currentType = objectTypes?.find(
        type => type?.name.toLowerCase() === objectName?.toLowerCase()
      );

      const currentTypeUrl = currentType?.url;

      if (objectTypes && objectName && currentTypeUrl) return currentTypeUrl;

      return '';
    })
  );

  readonly loading$ = new BehaviorSubject<boolean>(true);

  readonly hasData$ = new BehaviorSubject<boolean>(false);

  readonly objects$: Observable<Array<ZaakObject> | null> = combineLatest([
    this.documentId$,
    this.selectedObjecttypeUrl$,
  ]).pipe(
    switchMap(([documentId, selectedObjecttypeUrl]) =>
      documentId && selectedObjecttypeUrl
        ? this.zaakobjectenService.getDocumentObjectsOfType(documentId, selectedObjecttypeUrl).pipe(
            map(objects => objects.map(object => ({...object, title: object.title || '-'}))),
            tap(() => {
              this.loading$.next(false);
              this.hasData$.next(true);
            })
          )
        : of(null).pipe(
            tap(() => {
              this.loading$.next(false);
              this.hasData$.next(false);
            })
          )
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

  readonly noFormDefinitionComponent$ = new BehaviorSubject<boolean>(false);

  hasData: boolean;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly zaakobjectenService: ZaakobjectenService,
    private readonly modalService: ModalService
  ) {}

  rowClicked(object: ZaakObject): void {
    this.documentId$.pipe(take(1)).subscribe(documentId => {
      this.zaakobjectenService.getObjectTypeForm(documentId, object.url).subscribe(
        res => {
          const definition = res.formDefinition;
          definition.components = definition.components.map(component => ({
            ...component,
            disabled: true,
          }));
          this.setModalData(definition);
        },
        () => {
          this.setModalData();
        }
      );
    });
  }

  hide(): void {
    this.modalService.closeModal(() => {
      this.objectForm$.next(null);
    });
  }

  private show(): void {
    this.modalService.openModal(this.viewObjectModal);
  }

  private setModalData(definition?: FormioForm): void {
    if (definition) {
      this.objectForm$.next(definition);
      this.noFormDefinitionComponent$.next(false);
    } else {
      this.noFormDefinitionComponent$.next(true);
    }

    this.show();
  }
}
