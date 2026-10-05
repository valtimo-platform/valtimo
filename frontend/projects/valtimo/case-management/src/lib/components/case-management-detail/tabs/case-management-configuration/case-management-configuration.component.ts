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

import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, signal} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Add16} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';
import {
  ActionItem,
  CarbonListModule,
  ColumnConfig,
  ConfirmationModalModule,
  ViewType,
} from '@valtimo/components';
import {
  CaseManagementParams,
  EditPermissionsService,
  getCaseManagementRouteParams,
} from '@valtimo/shared';
import {ButtonModule, IconModule, IconService} from 'carbon-components-angular';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  map,
  Observable,
  shareReplay,
  Subject,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {CASE_MANAGEMENT_CONFIGURATION_TEST_IDS} from '../../../../constants';
import {CaseConfigurationItem, StatusModalCloseEvent} from '../../../../models';
import {CaseConfigurationApiService} from '../../../../services';
import {CaseManagementConfigurationEnvironmentValueModalComponent} from './case-management-configuration-environment-value-modal/case-management-configuration-environment-value-modal.component';
import {CaseManagementConfigurationModalComponent} from './case-management-configuration-modal/case-management-configuration-modal.component';

@Component({
  standalone: true,
  templateUrl: './case-management-configuration.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    CarbonListModule,
    ConfirmationModalModule,
    ButtonModule,
    IconModule,
    CaseManagementConfigurationModalComponent,
    CaseManagementConfigurationEnvironmentValueModalComponent,
  ],
})
export class CaseManagementConfigurationComponent {
  protected readonly testIds = CASE_MANAGEMENT_CONFIGURATION_TEST_IDS;

  public readonly $declarationModalOpen = signal<boolean>(false);
  public readonly $declarationToEdit = signal<CaseConfigurationItem | null>(null);
  public readonly $environmentValueModalOpen = signal<boolean>(false);
  public readonly $environmentValueItem = signal<CaseConfigurationItem | null>(null);
  public readonly $usedKeys = signal<string[]>([]);

  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly showClearEnvironmentValueModal$ = new Subject<boolean>();
  public readonly showDeleteModal$ = new Subject<boolean>();

  public readonly FIELDS: ColumnConfig[] = [
    {
      key: 'key',
      label: 'caseManagement.configuration.columns.key',
      viewType: ViewType.TEXT,
    },
    {
      key: 'defaultValue',
      label: 'caseManagement.configuration.columns.defaultValue',
      viewType: ViewType.TEXT,
    },
    {
      key: 'environmentValue',
      label: 'caseManagement.configuration.columns.environmentValue',
      viewType: ViewType.TEXT,
    },
  ];

  private readonly _reload$ = new BehaviorSubject<void>(undefined);

  public readonly params$: Observable<CaseManagementParams> = getCaseManagementRouteParams(
    this.route,
    true
  ).pipe(
    filter((params): params is CaseManagementParams => !!params),
    shareReplay({bufferSize: 1, refCount: true})
  );

  public readonly canEditDeclarations$: Observable<boolean> = this.params$.pipe(
    switchMap(params =>
      this.editPermissionsService.hasEditPermissions(
        params.caseDefinitionKey,
        params.caseDefinitionVersionTag
      )
    ),
    shareReplay({bufferSize: 1, refCount: true})
  );

  public readonly items$: Observable<CaseConfigurationItem[]> = combineLatest([
    this.params$,
    this._reload$,
  ]).pipe(
    tap(() => this.loading$.next(true)),
    switchMap(([params]) => this.caseConfigurationApiService.getConfigurations(params)),
    tap(items => {
      this.$usedKeys.set(items.map(item => item.key));
      this.loading$.next(false);
    })
  );

  private readonly SET_ENVIRONMENT_VALUE_ACTION: ActionItem = {
    label: 'caseManagement.configuration.setEnvironmentValue',
    callback: this.openEnvironmentValueModal.bind(this),
    type: 'normal',
  };

  private readonly CLEAR_ENVIRONMENT_VALUE_ACTION: ActionItem = {
    label: 'caseManagement.configuration.clearEnvironmentValue',
    callback: this.openClearEnvironmentValueModal.bind(this),
    disabledCallback: (item: CaseConfigurationItem) => item.environmentValue == null,
    type: 'normal',
  };

  public readonly actionItems$: Observable<ActionItem[]> = this.canEditDeclarations$.pipe(
    map(canEdit =>
      canEdit
        ? [
            {
              label: 'interface.edit',
              callback: this.openEditModal.bind(this),
              type: 'normal',
            },
            this.SET_ENVIRONMENT_VALUE_ACTION,
            this.CLEAR_ENVIRONMENT_VALUE_ACTION,
            {
              label: 'interface.delete',
              callback: this.openDeleteModal.bind(this),
              type: 'danger',
            },
          ]
        : [this.SET_ENVIRONMENT_VALUE_ACTION, this.CLEAR_ENVIRONMENT_VALUE_ACTION]
    )
  );

  constructor(
    private readonly caseConfigurationApiService: CaseConfigurationApiService,
    private readonly editPermissionsService: EditPermissionsService,
    private readonly iconService: IconService,
    private readonly route: ActivatedRoute
  ) {
    this.iconService.registerAll([Add16]);
  }

  public onRowClicked(item: CaseConfigurationItem): void {
    this.canEditDeclarations$
      .pipe(take(1))
      .subscribe(canEdit =>
        canEdit ? this.openEditModal(item) : this.openEnvironmentValueModal(item)
      );
  }

  public openAddModal(): void {
    this.$declarationToEdit.set(null);
    this.$declarationModalOpen.set(true);
  }

  public openEditModal(item: CaseConfigurationItem): void {
    this.$declarationToEdit.set(item);
    this.$declarationModalOpen.set(true);
  }

  public onDeclarationModalClose(event: StatusModalCloseEvent): void {
    this.$declarationModalOpen.set(false);
    if (event === 'closeAndRefresh') this.reload();
  }

  public openDeleteModal(item: CaseConfigurationItem): void {
    this.$declarationToEdit.set(item);
    this.showDeleteModal$.next(true);
  }

  public onConfirmDelete(item: CaseConfigurationItem): void {
    this.params$
      .pipe(
        take(1),
        switchMap(params => this.caseConfigurationApiService.deleteConfiguration(params, item.key))
      )
      .subscribe(() => this.reload());
  }

  public openEnvironmentValueModal(item: CaseConfigurationItem): void {
    this.$environmentValueItem.set(item);
    this.$environmentValueModalOpen.set(true);
  }

  public onEnvironmentValueModalClose(event: StatusModalCloseEvent): void {
    this.$environmentValueModalOpen.set(false);
    if (event === 'closeAndRefresh') this.reload();
  }

  public openClearEnvironmentValueModal(item: CaseConfigurationItem): void {
    this.$environmentValueItem.set(item);
    this.showClearEnvironmentValueModal$.next(true);
  }

  public onConfirmClearEnvironmentValue(item: CaseConfigurationItem): void {
    this.params$
      .pipe(
        take(1),
        switchMap(params =>
          this.caseConfigurationApiService.clearEnvironmentValue(params, item.key)
        )
      )
      .subscribe(() => this.reload());
  }

  private reload(): void {
    this._reload$.next();
  }
}
