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
import {Component} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {Search20, TrashCan20, Upload16} from '@carbon/icons';
import {ColumnConfig, MenuService, Pagination} from '@valtimo/components';
import {Page, TemplatePayload} from '@valtimo/document';
import {EnvironmentService} from '@valtimo/shared';
import {IconService} from 'carbon-components-angular';
import moment from 'moment';
import {BehaviorSubject, combineLatest, map, Observable, switchMap, take} from 'rxjs';
import {CaseListItem} from '../../models';
import {CaseManagementService} from '../../services';

moment.locale(localStorage.getItem('langKey') || '');

@Component({
  standalone: false,
  selector: 'valtimo-case-management-list',
  templateUrl: './case-management-list.component.html',
  styleUrls: ['./case-management-list.component.scss'],
})
export class CaseManagementListComponent {
  private readonly _refresh$ = new BehaviorSubject<null>(null);
  public readonly pagination$ = new BehaviorSubject<Pagination | null>(null);

  public readonly canUpdateGlobalConfiguration$ =
    this.environmentService.canUpdateGlobalConfiguration();

  public readonly caseListItems$: Observable<CaseListItem[]> = combineLatest([
    this.route.queryParams,
    this.canUpdateGlobalConfiguration$,
    this._refresh$,
  ]).pipe(
    switchMap(([params, canUpdate]) =>
      this.caseManagementService.getCaseDefinitions({
        ...params,
        active: true,
        final: canUpdate ? '' : true,
      })
    ),
    map((page: Page<CaseListItem>) => {
      this.pagination$.next({
        size: page.size,
        page: page.number + 1,
        collectionSize: +page.totalElements,
      });
      return page.content;
    })
  );

  public pagination: Pagination = {
    collectionSize: 0,
    page: 1,
    size: 10,
  };

  public readonly FIELDS: ColumnConfig[] = [
    {key: 'name', label: 'caseManagement.listColumns.name'},
    {key: 'caseDefinitionKey', label: 'caseManagement.listColumns.key'},
    {key: 'caseDefinitionVersionTag', label: 'caseManagement.listColumns.version'},
  ];

  public readonly showCreateModal$ = new BehaviorSubject<boolean>(false);
  public readonly showUploadModal$ = new BehaviorSubject<boolean>(false);

  private _paginationInitialized = false;
  constructor(
    private readonly caseManagementService: CaseManagementService,
    private readonly iconService: IconService,
    private readonly menuService: MenuService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly environmentService: EnvironmentService
  ) {
    this.iconService.registerAll([Search20, TrashCan20, Upload16]);
  }

  public onCloseUploadModal(definitionUploaded: boolean): void {
    this.showUploadModal$.next(false);

    if (!definitionUploaded) {
      return;
    }
    this._refresh$.next(null);
    this.menuService.reload();
  }

  public onCloseCreateModal(templatePayload: TemplatePayload | null): void {
    this.showCreateModal$.next(false);
    if (!templatePayload) {
      return;
    }

    this.caseManagementService
      .createDraftVersion(templatePayload)
      .pipe(take(1))
      .subscribe((response: any) => {
        this.router.navigate([
          '/case-management/case',
          response.caseDefinitionKey,
          'version',
          response.caseDefinitionVersionTag,
        ]);
      });
  }

  public paginationClicked(page: number): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {page: page - 1},
      queryParamsHandling: 'merge',
    });
  }

  public paginationSet(size: number): void {
    if (!this._paginationInitialized) {
      this._paginationInitialized = true;
      return;
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {size},
      queryParamsHandling: 'merge',
    });
  }

  public redirectToDetails(caseListItem: CaseListItem): void {
    this.router.navigate([
      '/case-management/case',
      caseListItem.caseDefinitionKey,
      'version',
      caseListItem.caseDefinitionVersionTag,
    ]);
  }

  public showUploadModal(): void {
    this.showUploadModal$.next(true);
  }

  public showCreateModal(): void {
    this.showCreateModal$.next(true);
  }
}
