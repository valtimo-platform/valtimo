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

import {ChangeDetectionStrategy, Component} from '@angular/core';
import {CarbonListModule, ColumnConfig, Pagination, ViewType} from '@valtimo/components';
import {BehaviorSubject, map, Observable, switchMap} from 'rxjs';
import {DocumentDefinition, DocumentService, Page} from '@valtimo/document';
import moment from 'moment/moment';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {Router} from '@angular/router';

@Component({
  templateUrl: './task-management.component.html',
  styleUrls: ['./task-management.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CarbonListModule, TranslateModule],
})
export class TaskManagementComponent {
  public pagination: Pagination = {
    collectionSize: 0,
    page: 1,
    size: 10,
  };

  private readonly _refreshData$ = new BehaviorSubject<null>(null);

  public readonly dossiers$: Observable<DocumentDefinition[]> = this._refreshData$.pipe(
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

  public readonly dossierFields: ColumnConfig[] = [
    {key: 'schema.title', label: 'taskManagement.caseName', viewType: ViewType.TEXT},
  ];

  constructor(
    private readonly documentService: DocumentService,
    private readonly router: Router
  ) {}

  public paginationClicked(page: number): void {
    this.pagination = {...this.pagination, page};
    this._refreshData$.next(null);
  }

  public paginationSet(size: number): void {
    this.pagination = {...this.pagination, size};
    this._refreshData$.next(null);
  }

  public redirectToDetails(documentDefinition: DocumentDefinition): void {
    this.router.navigate(['/task-management/dossier', documentDefinition.id.name]);
  }
}
