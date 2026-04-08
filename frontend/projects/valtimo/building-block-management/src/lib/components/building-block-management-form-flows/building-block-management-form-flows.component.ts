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
import {ActionItem, CarbonListModule, ColumnConfig, ConfirmationModalModule, ViewType} from '@valtimo/components';
import {GlobalNotificationService} from '@valtimo/shared';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {ButtonModule, IconModule, IconService} from 'carbon-components-angular';
import {Add16} from '@carbon/icons';
import {Router} from '@angular/router';
import {BUILDING_BLOCK_MANAGEMENT_TABS} from '../../constants';
import {FormFlowDefinitionItem} from '../../models';
import {ListFormFlowDefinition, NewFormFlowModalComponent} from '@valtimo/form-flow-management';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-management-form-flows',
  templateUrl: './building-block-management-form-flows.component.html',
  imports: [
    CommonModule,
    CarbonListModule,
    TranslateModule,
    ButtonModule,
    IconModule,
    ConfirmationModalModule,
    NewFormFlowModalComponent,
  ],
})
export class BuildingBlockManagementFormFlowsComponent implements OnInit, OnDestroy {
  public readonly $loading = signal<boolean>(true);

  private readonly _formFlowDefinitions$ = new BehaviorSubject<ListFormFlowDefinition[]>([]);

  private _formFlowDefinitionItems: FormFlowDefinitionItem[] = [];
  public readonly formFlowDefinitionItems$: Observable<FormFlowDefinitionItem[]> = combineLatest([
    this._formFlowDefinitions$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([definitions]) =>
      definitions.map(definition => ({
        ...definition,
        latestVersion: definition.versions?.[0] ?? 0,
      }))
    ),
    tap(items => (this._formFlowDefinitionItems = items))
  );

  public readonly FIELDS: ColumnConfig[] = [
    {key: 'key', label: 'formFlow.key'},
    {key: 'latestVersion', label: 'formFlow.version'},
    {
      viewType: ViewType.BOOLEAN,
      key: 'readOnly',
      label: 'formFlow.readOnly',
    },
  ];

  public onDeleteClick = (formFlow: FormFlowDefinitionItem): void => {
    this._formFlowToDelete = formFlow;
    this.showDeleteModal$.next(true);
  };

  public readonly ACTION_ITEMS: ActionItem[] = [
    {
      label: 'interface.edit',
      callback: this.onEditClick.bind(this),
      type: 'normal',
      disabledCallback: this.editDisabled.bind(this),
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

  private readonly _refresh$ = new BehaviorSubject<null>(null);
  private readonly _subscriptions = new Subscription();

  private _formFlowToDelete!: FormFlowDefinitionItem;
  private _isFinal = false;

  constructor(
    private readonly buildingBlockManagementDetailService: BuildingBlockManagementDetailService,
    private readonly buildingBlockManagementApiService: BuildingBlockManagementApiService,
    private readonly translateService: TranslateService,
    private readonly iconService: IconService,
    private readonly router: Router,
    private readonly notificationService: GlobalNotificationService
  ) {
    this.iconService.registerAll([Add16]);
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
            combineLatest([this.buildingBlockManagementDetailService.reloadFormFlowDefinitions$, this._refresh$]).pipe(
              tap(() => this.$loading.set(true)),
              switchMap(() =>
                this.buildingBlockManagementApiService.getBuildingBlockFormFlowDefinitions(
                  key,
                  versionTag
                )
              )
            )
          ),
          tap(response => {
            this._formFlowDefinitions$.next(response?.content ?? []);
            this.$loading.set(false);
          })
        )
        .subscribe()
    );

    this._subscriptions.add(this.isFinal$.subscribe(isFinal => (this._isFinal = isFinal)));
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onRowClick(formFlow: FormFlowDefinitionItem): void {
    this.navigateToFormFlowEditor(formFlow.key);
  }

  private navigateToFormFlowEditor(formFlowDefinitionKey: string): void {
    this.router.navigate([
      '/building-block-management',
      'building-block',
      this.buildingBlockManagementDetailService.buildingBlockDefinitionKey,
      'version',
      this.buildingBlockManagementDetailService.buildingBlockDefinitionVersionTag,
      BUILDING_BLOCK_MANAGEMENT_TABS.FORM_FLOWS,
      formFlowDefinitionKey,
    ]);
  }

  public onCreateClick(): void {
    this.showCreateModal$.next(true);
  }

  public onAdd(formFlowDefinition: any | null): void {
    this.showCreateModal$.next(false);

    if (!formFlowDefinition) return;

    this.$loading.set(true);

    this.buildingBlockManagementApiService
      .createBuildingBlockFormFlowDefinition(
        this.buildingBlockManagementDetailService.buildingBlockDefinitionKey,
        this.buildingBlockManagementDetailService.buildingBlockDefinitionVersionTag,
        formFlowDefinition
      )
      .subscribe({
        next: (result) => {
          this.navigateToFormFlowEditor(result.key);
        },
        error: () => {
          this.$loading.set(false);
        },
      });
  }

  public onEditClick(formFlow: FormFlowDefinitionItem): void {
    this.onRowClick(formFlow);
  }

  public onDeleteConfirm(): void {
    if (!this._formFlowToDelete) return;

    this.$loading.set(true);

    this.buildingBlockManagementApiService
      .deleteBuildingBlockFormFlowDefinition(
        this.buildingBlockManagementDetailService.buildingBlockDefinitionKey,
        this.buildingBlockManagementDetailService.buildingBlockDefinitionVersionTag,
        this._formFlowToDelete.key
      )
      .subscribe({
        next: () => {
          this.notificationService.showToast({
            type: 'success',
            title: this.translateService.instant('formFlow.deletedSuccessfully', {
              key: this._formFlowToDelete.key,
            }),
          });
          this._refresh$.next(null);
        },
        error: () => {
          this.$loading.set(false);
        },
      });
  }

  private editDisabled(): boolean {
    return this._isFinal;
  }

  private deleteDisabled(formFlow: FormFlowDefinitionItem): boolean {
    return !!formFlow.readOnly || this._isFinal;
  }
}
