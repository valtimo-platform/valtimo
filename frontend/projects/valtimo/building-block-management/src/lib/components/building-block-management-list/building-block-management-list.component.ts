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
import {Component, OnDestroy, OnInit, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
  CarbonListModule,
  ColumnConfig,
  DEFAULT_PAGINATION,
  Pagination,
  ViewType,
} from '@valtimo/components';
import {BuildingBlockManagementApiService, BuildingBlockManagementService} from '../../services';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  map,
  Observable,
  of,
  Subscription,
  switchMap,
  tap,
} from 'rxjs';
import {isEqual} from 'lodash';
import {ButtonModule, IconModule, IconService} from 'carbon-components-angular';
import {TranslatePipe} from '@ngx-translate/core';
import {BuildingBlockManagementCreateModalComponent} from '../building-block-management-create-modal/building-block-management-create-modal.component';
import {BuildingBlockDefinitionDto} from '@valtimo/shared';
import {Upload16} from '@carbon/icons';
import {Router} from '@angular/router';
import {BUILDING_BLOCK_MANAGEMENT_LIST_TEST_IDS, BUILDING_BLOCK_MANAGEMENT_TABS} from '../../constants';
import {BuildingBlockManagementUploadModalComponent} from '../building-block-management-upload-modal/building-block-management-upload-modal.component';
import {BuildingBlockDefinitionQuery} from '../../models';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-management-list',
  templateUrl: './building-block-management-list.component.html',
  styleUrls: ['./building-block-management-list.component.scss'],
  imports: [
    CommonModule,
    CarbonListModule,
    ButtonModule,
    IconModule,
    TranslatePipe,
    BuildingBlockManagementCreateModalComponent,
    BuildingBlockManagementUploadModalComponent,
  ],
  providers: [BuildingBlockManagementService],
})
export class BuildingBlockManagementListComponent implements OnInit, OnDestroy {
  protected readonly testIds = BUILDING_BLOCK_MANAGEMENT_LIST_TEST_IDS;

  public readonly $loading = signal<boolean>(true);

  private readonly _collectionSize$ = new BehaviorSubject<number>(0);

  /*
    Page, size and search term live in a single subject so that a search - which also resets the
    page - results in one request rather than two.
  */
  private readonly _query$ = new BehaviorSubject<BuildingBlockDefinitionQuery>({
    page: DEFAULT_PAGINATION.page,
    searchTerm: '',
    size: DEFAULT_PAGINATION.size,
  });

  private get _query(): BuildingBlockDefinitionQuery {
    return this._query$.getValue();
  }

  public readonly pagination$: Observable<Pagination> = combineLatest([
    this._collectionSize$,
    this._query$,
  ]).pipe(map(([collectionSize, {page, size}]) => ({collectionSize, page, size}) as Pagination));

  public readonly buildingBlockDefinitions$: Observable<BuildingBlockDefinitionDto[]> =
    combineLatest([this.buildingBlockManagementService.reload$, this._query$]).pipe(
      tap(() => this.$loading.set(true)),
      switchMap(([, {page, searchTerm, size}]) =>
        this.buildingBlockManagementApiService
          .searchBuildingBlockDefinitions({
            page: page - 1,
            size,
            ...(searchTerm && {searchTerm}),
          })
          // Caught inside the switchMap: an error on the outer stream would terminate it, stranding the skeleton.
          .pipe(catchError(() => of(null)))
      ),
      tap(res => {
        this._collectionSize$.next(res?.totalElements ?? 0);
        this.$loading.set(false);
      }),
      map(res => res?.content ?? [])
    );

  public readonly buildingBlockDefinitions$: Observable<BuildingBlockDefinitionDto[]> =
    combineLatest([this.buildingBlockManagementService.reload$, this._query$]).pipe(
      tap(() => this.$loading.set(true)),
      switchMap(([, {page, searchTerm, size}]) =>
        this.buildingBlockManagementApiService.searchBuildingBlockDefinitions({
          page: page - 1,
          size,
          ...(searchTerm && {searchTerm}),
        })
      ),
      map(res => {
        this._collectionSize$.next(res?.totalElements ?? 0);
        this.$loading.set(false);

        return res?.content ?? [];
      })
    );

  public readonly FIELDS: ColumnConfig[] = [
    {key: 'name', label: 'buildingBlockManagement.listColumns.name'},
    {key: 'key', label: 'buildingBlockManagement.listColumns.key'},
    {
      key: 'versionTag',
      label: 'buildingBlockManagement.listColumns.versionTag',
      viewType: ViewType.TAGS,
    },
  ];

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly buildingBlockManagementApiService: BuildingBlockManagementApiService,
    private readonly buildingBlockManagementService: BuildingBlockManagementService,
    private readonly iconService: IconService,
    private readonly router: Router
  ) {
    this.iconService.registerAll([Upload16]);
  }

  public ngOnInit(): void {
    /*
      The create modal validates that a key is not taken yet, so it needs every key rather than the
      keys on the current page. Kept separate from the paginated list request for that reason.
    */
    this._subscriptions.add(
      this.buildingBlockManagementService.reload$
        .pipe(switchMap(() => this.buildingBlockManagementApiService.getBuildingBlockDefinitions()))
        .subscribe(definitions =>
          this.buildingBlockManagementService.setUsedKeys(definitions.map(item => item.key))
        )
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public paginationClicked(page: number): void {
    this.updateQuery({page});
  }

  public paginationSet(size: number | string): void {
    this.updateQuery({size: Number(size), page: 1});
  }

  public searchTermEntered(searchTerm: string | null): void {
    this.updateQuery({searchTerm: searchTerm ?? '', page: 1});
  }

  private updateQuery(update: Partial<BuildingBlockDefinitionQuery>): void {
    const query = {...this._query, ...update};

    /*
      The list emits paginationSet once on init with the size it restored from local storage, which
      is usually the size we already hold. Ignoring no-op updates keeps that from costing a request.
    */
    if (isEqual(query, this._query)) return;

    this._query$.next(query);
  }

  public showCreateModal(): void {
    this.buildingBlockManagementService.showCreateModal();
  }

  public showUploadModal(): void {
    this.buildingBlockManagementService.showUploadModal();
  }

  public onRowClick(buildingBlockDefinition: BuildingBlockDefinitionDto): void {
    this.router.navigate([
      '/building-block-management',
      'building-block',
      buildingBlockDefinition.key,
      'version',
      buildingBlockDefinition.versionTag,
      BUILDING_BLOCK_MANAGEMENT_TABS.GENERAL,
    ]);
  }
}
