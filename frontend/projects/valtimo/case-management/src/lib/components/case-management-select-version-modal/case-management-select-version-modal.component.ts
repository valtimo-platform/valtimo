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

import {Component, EventEmitter, Input, Output} from '@angular/core';
import {BehaviorSubject, Observable, switchMap} from 'rxjs';
import {ColumnConfig, Pagination, ViewType} from '@valtimo/components';
import {CaseManagementService} from '../../services';
import {filter, map} from 'rxjs/operators';
import {CaseListItem} from '../../models';
import {Page} from '@valtimo/document';
import {CaseVersionListItem} from '../../models/case-version-list.model';

const DEFAULT_PAGE_SIZE = 10;

interface VersionQuery {
  caseDefinitionKey: string;
  page: number;
  size: number;
}

@Component({
  standalone: false,
  selector: 'valtimo-case-management-select-version-modal',
  templateUrl: './case-management-select-version-modal.component.html',
  styleUrls: ['./case-management-select-version-modal.component.scss'],
})
export class CaseManagementSelectVersionModalComponent {
  @Input() open = false;
  @Input() previousSelectedVersion = '';

  public readonly caseDefinitionTitle$ = new BehaviorSubject<string>('');
  @Input() set caseDefinitionKey(value: string) {
    this._query$.next({...this._query$.value, caseDefinitionKey: value, page: 0});
  }
  @Input() set caseDefinitionTitle(value: string) {
    this.caseDefinitionTitle$.next(value);
  }

  @Output() closeEvent = new EventEmitter();
  @Output() selectedVersion = new EventEmitter();

  private _paginationInitialized = false;

  // Key, page and size live in one subject so a change to any of them fires a single request.
  private readonly _query$ = new BehaviorSubject<VersionQuery>({
    caseDefinitionKey: '',
    page: 0,
    size: DEFAULT_PAGE_SIZE,
  });

  public readonly pagination$ = new BehaviorSubject<Pagination | null>(null);

  public readonly versionItems$: Observable<CaseListItem[]> = this._query$.pipe(
    filter(({caseDefinitionKey}) => !!caseDefinitionKey),
    switchMap(query => this.caseManagementService.getAllCaseVersions(query)),
    map((page: Page<CaseVersionListItem>) => {
      this.pagination$.next({
        size: page.size,
        page: page.number + 1,
        collectionSize: +page.totalElements,
      });

      return page.content.map((version: any) => ({
        ...version,
        versionTags: [
          {
            content: version.final
              ? version.caseDefinitionVersionTag
              : `DRAFT: ${version.caseDefinitionVersionTag}`,
            type: version.final ? 'green' : 'red',
          },
        ],
      }));
    })
  );

  public readonly FIELDS: ColumnConfig[] = [
    {
      key: 'versionTags',
      label: 'caseManagement.allVersionsModal.columns.version',
      viewType: ViewType.TAGS,
    },
    {
      key: 'createdDate',
      label: 'caseManagement.allVersionsModal.columns.release',
      viewType: ViewType.DATE_TIME,
    },
    {
      key: 'description',
      label: 'caseManagement.allVersionsModal.columns.description',
      viewType: ViewType.TEXT,
    },
  ];

  constructor(private readonly caseManagementService: CaseManagementService) {}

  public paginationClicked(page: number): void {
    this._query$.next({...this._query$.value, page: page - 1});
  }

  public paginationSet(size: number): void {
    if (!this._paginationInitialized) {
      this._paginationInitialized = true;
      return;
    }

    this._query$.next({...this._query$.value, page: 0, size: +size});
  }

  public selectActiveVersion(event: {caseDefinitionVersionTag: string}): void {
    this.emitSelectedVersion(event?.caseDefinitionVersionTag);
  }

  public onCloseModal(): void {
    this.emitSelectedVersion(this.previousSelectedVersion);
  }

  private emitSelectedVersion(caseDefinitionVersionTag: string): void {
    this.selectedVersion.emit(caseDefinitionVersionTag);
    this.closeEvent.emit();
  }
}
