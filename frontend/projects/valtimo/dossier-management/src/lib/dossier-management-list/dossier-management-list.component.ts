/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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
import {DocumentService, DocumentDefinition, Page} from '@valtimo/document';
import {Router} from '@angular/router';
import moment from 'moment';
import {BehaviorSubject} from 'rxjs';

moment.locale(localStorage.getItem('langKey') || '');

@Component({
  selector: 'valtimo-dossier-management-list',
  templateUrl: './dossier-management-list.component.html',
  styleUrls: ['./dossier-management-list.component.scss'],
})
export class DossierManagementListComponent {
  public dossiers: DocumentDefinition[] = [];
  public pagination = {
    collectionSize: 0,
    page: 1,
    size: 10,
    maxPaginationItemSize: 5,
  };
  public pageParam = 0;
  public dossierFields = [
    {key: 'schema.title', label: 'Title'},
    {key: 'createdOn', label: 'Created On'},
    {key: 'readOnly', label: 'Read-only'},
  ];

  readonly showModal$ = new BehaviorSubject<boolean>(false);

  constructor(private documentService: DocumentService, private router: Router) {}

  public paginationClicked(page) {
    this.pageParam = page - 1;
    this.getDocumentDefinitions();
  }

  paginationSet() {
    this.getDocumentDefinitions();
  }

  redirectToDetails(documentDefinition: DocumentDefinition) {
    this.router.navigate(['/dossier-management/dossier', documentDefinition.id.name]);
  }

  private getDocumentDefinitions() {
    this.documentService
      .queryDefinitionsForManagement({page: this.pageParam, size: this.pagination.size})
      .subscribe((documentDefinitionPage: Page<DocumentDefinition>) => {
        this.pagination.collectionSize = documentDefinitionPage.totalElements;
        this.dossiers = documentDefinitionPage.content;
        this.dossiers.map((dossier: DocumentDefinition) => {
          dossier.createdOn = moment(dossier.createdOn).format('DD MMM YYYY HH:mm');
        });
      });
  }

  showModal() {
    this.showModal$.next(true);
  }
}
