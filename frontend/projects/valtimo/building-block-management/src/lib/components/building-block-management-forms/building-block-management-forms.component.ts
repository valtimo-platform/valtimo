/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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
  BuildingBlockManagementApiService,
  BuildingBlockManagementDetailService,
} from '../../services';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  map,
  Observable,
  Subscription,
  switchMap,
  tap,
} from 'rxjs';
import {isEqual} from 'lodash';
import {
  ActionItem,
  CarbonListModule,
  ColumnConfig,
  ConfirmationModalModule,
  Pagination,
  ViewType,
} from '@valtimo/components';
import {FormManagementCreateComponent} from '@valtimo/form-management';
import {BuildingBlockFormDefinitionDto, GlobalNotificationService} from '@valtimo/shared';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {ButtonModule, IconModule, IconService} from 'carbon-components-angular';
import {Add16, Upload16} from '@carbon/icons';
import {Router} from '@angular/router';
import {BUILDING_BLOCK_MANAGEMENT_TABS} from '../../constants';
import {BuildingBlockFormDefinitionItem} from '../../models';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-management-forms',
  templateUrl: './building-block-management-forms.component.html',
  styleUrls: ['./building-block-management-forms.component.scss'],
  imports: [
    CommonModule,
    CarbonListModule,
    TranslateModule,
    ButtonModule,
    IconModule,
    ConfirmationModalModule,
    FormManagementCreateComponent,
  ],
})
export class BuildingBlockManagementFormsComponent implements OnInit, OnDestroy {
  public readonly $loading = signal<boolean>(true);

  private readonly _buildingBlockFormDefinitions$ = new BehaviorSubject<
    BuildingBlockFormDefinitionDto[]
  >([]);

  private _buildingBlockFormDefinitionItems: BuildingBlockFormDefinitionItem[] = [];
  public readonly buildingBlockFormDefinitionItems$: Observable<BuildingBlockFormDefinitionItem[]> =
    combineLatest([this._buildingBlockFormDefinitions$, this.translateService.stream('key')]).pipe(
      map(([formDefinitions]) =>
        formDefinitions.map(definition => ({
          ...definition,
          readOnlyText: definition.readOnly
            ? this.translateService.instant('formManagement.readOnly')
            : '',
        }))
      ),
      tap(
        buildingBlockFormDefinitionItems =>
          (this._buildingBlockFormDefinitionItems = buildingBlockFormDefinitionItems)
      )
    );

  public readonly FIELDS: ColumnConfig[] = [
    {key: 'name', label: 'buildingBlockManagement.formDefinition.name'},
    {
      key: 'readOnlyText',
      label: '',
      viewType: ViewType.TAGS,
    },
  ];

  public onDeleteClick = (form: BuildingBlockFormDefinitionItem): void => {
    this._formToDelete = form;
    this.showDeleteModal$.next(true);
  };

  public readonly ACTION_ITEMS: ActionItem[] = [
    {
      label: 'interface.edit',
      callback: this.onEditClick.bind(this),
      type: 'normal',
    },
    {
      label: 'interface.delete',
      callback: this.onDeleteClick,
      type: 'danger',
      disabledCallback: this.deleteDisabled.bind(this),
    },
  ];

  public readonly isFinal$ = this.buildingBlockManagementDetailService.isFinal$;

  public readonly showCreateModal$ = new BehaviorSubject<boolean>(false);
  public readonly showDeleteModal$ = new BehaviorSubject<boolean>(false);

  private readonly _collectionSize$ = new BehaviorSubject<number>(0);

  private readonly _partialPagination$ = new BehaviorSubject<Partial<Pagination>>({
    page: 1,
    size: 10,
  });

  private get _partialPagination(): Partial<Pagination> {
    return this._partialPagination$.getValue();
  }

  public pagination$: Observable<Pagination> = combineLatest([
    this._collectionSize$,
    this._partialPagination$,
  ]).pipe(
    map(
      ([collectionSize, partialPagination]) =>
        ({...partialPagination, collectionSize}) as Pagination
    )
  );

  public readonly searchTerm$ = new BehaviorSubject<string>('');

  private readonly _subscriptions = new Subscription();

  private _formToDelete!: BuildingBlockFormDefinitionItem;

  constructor(
    private readonly buildingBlockManagementDetailService: BuildingBlockManagementDetailService,
    private readonly buildingBlockManagementApiService: BuildingBlockManagementApiService,
    private readonly translateService: TranslateService,
    private readonly iconService: IconService,
    private readonly router: Router,
    private readonly notificationService: GlobalNotificationService
  ) {
    this.iconService.registerAll([Upload16, Add16]);
  }

  public ngOnInit(): void {
    this._subscriptions.add(
      combineLatest([
        this.buildingBlockManagementDetailService.buildingBlockDefinitionKey$,
        this.buildingBlockManagementDetailService.buildingBlockDefinitionVersionTag$,
      ])
        .pipe(
          distinctUntilChanged((a, b) => isEqual(a, b)),
          tap(() => this.$loading.set(true)),
          switchMap(([key, versionTag]) =>
            combineLatest([
              this.buildingBlockManagementDetailService.reloadFormDefinitions$,
              this._partialPagination$,
              this.searchTerm$,
            ]).pipe(
              tap(() => this.$loading.set(true)),
              switchMap(([, pagination, searchTerm]) =>
                this.buildingBlockManagementApiService.getBuildingBlockFormDefinitions(
                  key,
                  versionTag,
                  {
                    page: (pagination?.page ?? 1) - 1,
                    size: pagination?.size ?? 10,
                    ...(searchTerm && {searchTerm}),
                  }
                )
              )
            )
          ),
          tap(response => {
            this._collectionSize$.next(response?.totalElements ?? 0);
            this._buildingBlockFormDefinitions$.next(response?.content ?? []);
            this.$loading.set(false);
          })
        )
        .subscribe()
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onRowClick(formDefinition: BuildingBlockFormDefinitionItem): void {
    this.router.navigate([
      '/building-block-management',
      'building-block',
      this.buildingBlockManagementDetailService.buildingBlockDefinitionKey,
      'version',
      this.buildingBlockManagementDetailService.buildingBlockDefinitionVersionTag,
      BUILDING_BLOCK_MANAGEMENT_TABS.FORMS,
      formDefinition.id,
    ]);
  }

  public onCreateClick(): void {
    this.showCreateModal$.next(true);
  }

  public onGoBackFromCreateEvent(): void {
    this.showCreateModal$.next(false);
  }

  public onFormDefinitionCreateEvent(formDefinitionId: string): void {
    this.showCreateModal$.next(false);
    this.notificationService.showToast({
      type: 'success',
      title: this.translateService.instant('formManagement.notifications.created'),
    });
    this.onRowClick({id: formDefinitionId} as BuildingBlockFormDefinitionItem);
  }

  public onEditClick(form: BuildingBlockFormDefinitionItem): void {
    this.onRowClick(form);
  }

  public onDeleteConfirm(): void {
    if (!this._formToDelete) return;

    this.$loading.set(true);

    this.buildingBlockManagementApiService
      .deleteBuildingBlockFormDefinition(
        this.buildingBlockManagementDetailService.buildingBlockDefinitionKey,
        this.buildingBlockManagementDetailService.buildingBlockDefinitionVersionTag,
        this._formToDelete.id
      )
      .subscribe({
        next: () => {
          this.notificationService.showToast({
            type: 'success',
            title: this.translateService.instant('formManagement.notifications.deleted'),
          });
          this.buildingBlockManagementDetailService.reloadFormDefinitions();
        },
        error: () => {
          this.notificationService.showToast({
            type: 'error',
            title: this.translateService.instant('formManagement.notifications.deletionError'),
          });
          this.$loading.set(false);
        },
      });
  }

  public paginationClicked(page: number): void {
    this.updatePagination({page});
  }

  public paginationSet(size: number): void {
    this.updatePagination({size, page: 1});
  }

  public searchTermEntered(searchTerm: string): void {
    this.searchTerm$.next(searchTerm);
  }

  private updatePagination(update: Partial<Pagination>): void {
    this._partialPagination$.next({...this._partialPagination, ...update});
  }

  private deleteDisabled(form: BuildingBlockFormDefinitionItem): boolean {
    return form.readOnly;
  }
}
