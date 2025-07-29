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

import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, Params} from '@angular/router';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  ActionItem,
  BreadcrumbService,
  CarbonListModule,
  ColumnConfig,
  ConfirmationModalModule,
  PageTitleService,
  ViewType,
} from '@valtimo/components';
import {ButtonModule, IconModule} from 'carbon-components-angular';
import {
  BehaviorSubject,
  combineLatest,
  map,
  Observable,
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {
  IkoDataRequestResponse,
  IkoManagementParams,
  IkoRepositoryConfigResponse,
  IkoSearchField,
} from '../../../../models';
import {IkoManagementApiService} from '../../../../services';
import {IkoManagementSearchFieldModalComponent} from './search-field-modal/search-field-modal.component';

@Component({
  selector: 'valtimo-iko-management-search-fields',
  templateUrl: './iko-management-search-fields.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    ButtonModule,
    CarbonListModule,
    CommonModule,
    ConfirmationModalModule,
    IconModule,
    TranslateModule,
    IkoManagementSearchFieldModalComponent,
  ],
})
export class IkoManagementSearchFieldsComponent implements OnInit, OnDestroy {
  private readonly _refresh$ = new BehaviorSubject<null>(null);
  public readonly params$: Observable<IkoManagementParams> = this.route.params.pipe(
    map((params: Params) => ({
      apiKey: params.apiKey,
      aggregateKey: params.key,
      actionKey: params.actionKey,
      tabKey: params.tabKey,
    }))
  );
  public readonly loading$ = new BehaviorSubject<boolean>(true);

  public readonly searchFields$: Observable<IkoSearchField[]> = combineLatest([
    this.params$,
    this.translateService.stream('key'),
    this._refresh$,
  ]).pipe(
    switchMap(([params]) =>
      this.ikoManagementApiService.getIkoSearchFields(params.aggregateKey, params.actionKey)
    ),
    map((searchFields: IkoSearchField[]) =>
      searchFields.map((field: IkoSearchField) => ({
        ...field,
        dataTypeText: this.translateService.instant(`searchFields.${field.dataType}`),
        fieldTypeText: this.translateService.instant(`searchFieldsOverview.${field.fieldType}`),
      }))
    ),
    tap(() => this.loading$.next(false))
  );
  public readonly deleteModalOpen$ = new BehaviorSubject<boolean>(false);
  public readonly deleteFieldKey$ = new BehaviorSubject<string | null>(null);
  public readonly fieldModalOpen$ = new BehaviorSubject<boolean>(false);
  public readonly prefillData$ = new BehaviorSubject<IkoSearchField | null>(null);

  private readonly _searchAction$: Observable<IkoDataRequestResponse> = this.params$.pipe(
    switchMap((params: {aggregateKey: string; actionKey: string}) =>
      this.ikoManagementApiService.getIkoDataRequest(params.aggregateKey, params.actionKey)
    )
  );
  private readonly _ikoRepositoryConfig$: Observable<IkoRepositoryConfigResponse> =
    this.params$.pipe(
      switchMap((params: IkoManagementParams) =>
        this.ikoManagementApiService.getIkoRepositoryConfig(params.apiKey)
      )
    );

  public readonly FIELDS: ColumnConfig[] = [
    {
      key: 'key',
      label: 'interface.key',
      viewType: ViewType.TEXT,
    },
    {
      key: 'title',
      label: 'interface.title',
      viewType: ViewType.TEXT,
    },
    {
      key: 'path',
      label: 'searchFieldsOverview.path',
      viewType: ViewType.TEXT,
    },
    {
      key: 'dataTypeText',
      label: 'searchFieldsOverview.dataType',
      viewType: ViewType.TEXT,
    },
    {
      key: 'fieldTypeText',
      label: 'searchFieldsOverview.fieldType',
      viewType: ViewType.TEXT,
    },
  ];

  public readonly ACTION_ITEMS: ActionItem[] = [
    {
      label: 'interface.edit',
      callback: this.editSearchField.bind(this),
    },
    {
      label: 'interface.delete',
      callback: this.deleteSearchField.bind(this),
      type: 'danger',
    },
  ];

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly breadcrumbService: BreadcrumbService,
    private readonly ikoManagementApiService: IkoManagementApiService,
    private readonly pageTitleService: PageTitleService,
    private readonly route: ActivatedRoute,
    private readonly translateService: TranslateService
  ) {}

  public ngOnInit(): void {
    this.setBreadcrumbs();
    this._subscriptions.add(
      combineLatest([this._searchAction$, this.translateService.stream('key')]).subscribe(
        ([searchAction]) => {
          this.pageTitleService.setCustomPageTitle(
            this.translateService.instant('ikoManagement.searchFields.pageTitle', {
              searchActionTitle: searchAction.title,
            }),
            true
          );
        }
      )
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this.pageTitleService.enableReset();
    this.breadcrumbService.clearThirdBreadcrumb();
    this.breadcrumbService.clearFourthBreadcrumb();
  }

  public onItemsReordered(
    searchFields: IkoSearchField[],
    params: {aggregateKey: string; actionKey: string}
  ): void {
    this.ikoManagementApiService
      .updateIkoSearchFields(params.aggregateKey, params.actionKey, searchFields)
      .pipe(take(1))
      .subscribe();
  }

  public openAddModal(): void {
    this.fieldModalOpen$.next(true);
  }

  public deleteSearchField(field: IkoSearchField): void {
    this.deleteFieldKey$.next(field.key);
    this.deleteModalOpen$.next(true);
  }

  public editSearchField(field: IkoSearchField): void {
    this.prefillData$.next(field);
    this.fieldModalOpen$.next(true);
  }

  public onDeleteSearchField(key: string): void {
    this.params$
      .pipe(
        switchMap((params: {aggregateKey: string; actionKey: string}) =>
          this.ikoManagementApiService.deleteIkoSearchField(
            params.aggregateKey,
            params.actionKey,
            key
          )
        )
      )
      .subscribe(() => this._refresh$.next(null));
  }

  public onModalClose(field: IkoSearchField | null): void {
    this.fieldModalOpen$.next(false);
    if (!field) return;

    this.params$
      .pipe(
        switchMap((params: {aggregateKey: string; actionKey: string}) =>
          this.prefillData$.getValue() === null
            ? this.ikoManagementApiService.createIkoSearchField(
                params.aggregateKey,
                params.actionKey,
                field.key,
                field
              )
            : this.ikoManagementApiService.updateIkoSearchField(
                params.aggregateKey,
                params.actionKey,
                field.key,
                field
              )
        )
      )
      .subscribe(() => this._refresh$.next(null));
  }

  private setBreadcrumbs(): void {
    combineLatest([
      this._ikoRepositoryConfig$,
      this.params$,
      this.translateService.stream('key'),
    ]).subscribe(([repositoryConfig, params]) => {
      this.breadcrumbService.setThirdBreadcrumb({
        route: [`/iko-management/${repositoryConfig.key}`],
        content: repositoryConfig.title,
        href: `/iko-management/${repositoryConfig.key}`,
      });

      this.breadcrumbService.setFourthBreadcrumb({
        route: [`/iko-management/${repositoryConfig.key}/${params.aggregateKey}/${params.tabKey}`],
        content: this.translateService.instant('ikoManagement.searchActions.title'),
        href: `/iko-management/${repositoryConfig.key}/${params.aggregateKey}/${params.tabKey}`,
      });
    });
  }
}
