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
import {Component} from '@angular/core';
import {Router} from '@angular/router';
import {Search20, TrashCan20, Upload16} from '@carbon/icons';
import {ColumnConfig, MenuService, Pagination, ViewType} from '@valtimo/components';
import {
  DocumentDefinition,
  DocumentService,
  Page,
  TemplatePayload,
  CreateDocumentDefinitionResponse,
} from '@valtimo/document';
import {IconService} from 'carbon-components-angular';
import moment from 'moment';
import {BehaviorSubject, map, Observable, switchMap, take} from 'rxjs';

moment.locale(localStorage.getItem('langKey') || '');

@Component({
  selector: 'valtimo-dossier-management-list',
  templateUrl: './dossier-management-list.component.html',
  styleUrls: ['./dossier-management-list.component.scss'],
})
export class DossierManagementListComponent {
  public pagination: Pagination = {
    collectionSize: 0,
    page: 1,
    size: 10,
  };

  private readonly _refreshData$ = new BehaviorSubject<null>(null);
  public dossiers$: Observable<DocumentDefinition[]> = this._refreshData$.pipe(
    switchMap(() =>
      this.documentService.queryDefinitionsForManagement({
        page: this.pagination.page - 1,
        size: this.pagination.size,
      })
    ),
    map((documentDefinitionPage: Page<DocumentDefinition>) => {
      this.pagination = {
        ...this.pagination,
        collectionSize: documentDefinitionPage.totalElements,
      };

      return documentDefinitionPage.content.map((documentDefinition: DocumentDefinition) => ({
        ...documentDefinition,
        createdOn: moment(documentDefinition.createdOn).format('DD MMM YYYY HH:mm'),
      }));
    })
  );

  public dossierFields: ColumnConfig[] = [
    {key: 'schema.title', label: 'fieldLabels.title', viewType: ViewType.TEXT},
    {key: 'createdOn', label: 'fieldLabels.createdOn', viewType: ViewType.TEXT},
    {key: 'readOnly', label: 'fieldLabels.readOnly', viewType: ViewType.BOOLEAN},
  ];

  public readonly showCreateModal$ = new BehaviorSubject<boolean>(false);
  public readonly showUploadModal$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly documentService: DocumentService,
    private readonly iconService: IconService,
    private readonly menuService: MenuService,
    private readonly router: Router
  ) {
    this.iconService.registerAll([Search20, TrashCan20, Upload16]);
  }

  public onCloseUploadModal(definitionUploaded: boolean): void {
    this.showUploadModal$.next(false);

    if (!definitionUploaded) {
      return;
    }
    this._refreshData$.next(null);
    this.menuService.reload();
  }

  public onCloseCreateModal(templatePayload: TemplatePayload | null): void {
    this.showCreateModal$.next(false);
    if (!templatePayload) {
      return;
    }

    this.documentService
      .createDocumentDefinitionTemplate(templatePayload)
      .pipe(take(1))
      .subscribe((response: CreateDocumentDefinitionResponse) => {
        this.redirectToDetails(response.documentDefinition);
      });
  }

  public paginationClicked(page: number): void {
    this.pagination = {...this.pagination, page};
    this._refreshData$.next(null);
  }

  public paginationSet(size: number): void {
    this.pagination = {...this.pagination, size};
    this._refreshData$.next(null);
  }

  public redirectToDetails(documentDefinition: DocumentDefinition): void {
    this.router.navigate(['/dossier-management/dossier', documentDefinition.id.name]);
  }

  public showUploadModal(): void {
    this.showUploadModal$.next(true);
  }

  public showCreateModal(): void {
    this.showCreateModal$.next(true);
  }
}
