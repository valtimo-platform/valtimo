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

import {Component, OnDestroy, OnInit, signal, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
  BuildingBlockManagementApiService,
  BuildingBlockManagementDetailService,
} from '../../services';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
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
} from '@valtimo/components';
import {
  Decision,
  DecisionFormModalComponent,
  DecisionFormValue,
  DecisionDeployComponent,
  DecisionService,
  DecisionStateService,
  parseDecisionForm,
  toDecisionFileName,
  updateDmnXml,
} from '@valtimo/decision';
import {GlobalNotificationService} from '@valtimo/shared';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {ButtonModule, IconModule, IconService} from 'carbon-components-angular';
import {Add16, Upload16} from '@carbon/icons';
import {Router} from '@angular/router';
import {BUILDING_BLOCK_MANAGEMENT_TABS} from '../../constants';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-management-decisions',
  templateUrl: './building-block-management-decisions.component.html',
  imports: [
    CommonModule,
    CarbonListModule,
    TranslateModule,
    ButtonModule,
    IconModule,
    ConfirmationModalModule,
    DecisionDeployComponent,
    DecisionFormModalComponent,
  ],
})
export class BuildingBlockManagementDecisionsComponent implements OnInit, OnDestroy {
  @ViewChild('decisionEdit') edit: DecisionFormModalComponent;

  public readonly $loading = signal<boolean>(true);

  private readonly _decisions$ = new BehaviorSubject<Decision[]>([]);
  public readonly decisions$: Observable<Decision[]> = this._decisions$.asObservable();

  public readonly FIELDS: ColumnConfig[] = [
    {key: 'key', label: 'Key'},
    {key: 'name', label: 'Name'},
  ];

  public onDeleteClick = (decision: Decision): void => {
    this._decisionToDelete = decision;
    this.showDeleteModal$.next(true);
  };

  public readonly ACTION_ITEMS: ActionItem[] = [
    {
      label: 'interface.edit',
      callback: this.openEditModal.bind(this),
      type: 'normal',
      disabledCallback: this.deleteDisabled.bind(this),
    },
    {
      label: 'interface.delete',
      callback: this.onDeleteClick,
      type: 'danger',
      disabledCallback: this.deleteDisabled.bind(this),
    },
  ];

  public readonly isFinal$ = this.buildingBlockManagementDetailService.isFinal$;

  public readonly showDeleteModal$ = new BehaviorSubject<boolean>(false);

  private readonly _subscriptions = new Subscription();
  private _decisionToDelete!: Decision;
  private _decisionToEdit: Decision | null = null;
  private _editXml: string | null = null;
  private _isFinal = false;

  constructor(
    private readonly buildingBlockManagementDetailService: BuildingBlockManagementDetailService,
    private readonly buildingBlockManagementApiService: BuildingBlockManagementApiService,
    private readonly decisionStateService: DecisionStateService,
    private readonly decisionService: DecisionService,
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
            this.decisionStateService.refreshDecisions$.pipe(
              tap(() => this.$loading.set(true)),
              switchMap(() =>
                this.buildingBlockManagementApiService.getBuildingBlockDecisionDefinitions(
                  key,
                  versionTag
                )
              )
            )
          ),
          tap(decisions => {
            this._decisions$.next(decisions);
            this.$loading.set(false);
          })
        )
        .subscribe()
    );

    this._subscriptions.add(
      this.isFinal$.subscribe(isFinal => (this._isFinal = isFinal))
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onRowClick(decision: Decision): void {
    this.router.navigate([
      '/building-block-management',
      'building-block',
      this.buildingBlockManagementDetailService.buildingBlockDefinitionKey,
      'version',
      this.buildingBlockManagementDetailService.buildingBlockDefinitionVersionTag,
      BUILDING_BLOCK_MANAGEMENT_TABS.DECISIONS,
      decision.id,
    ]);
  }

  public onCreateDecision(value: DecisionFormValue): void {
    this.router.navigate(
      [
        '/building-block-management',
        'building-block',
        this.buildingBlockManagementDetailService.buildingBlockDefinitionKey,
        'version',
        this.buildingBlockManagementDetailService.buildingBlockDefinitionVersionTag,
        BUILDING_BLOCK_MANAGEMENT_TABS.DECISIONS,
        'create',
      ],
      {state: {decisionName: value.name, inputVariables: value.inputVariables}}
    );
  }

  public openEditModal(decision: Decision): void {
    this.decisionService.getDecisionXml(decision.id).subscribe(xml => {
      this._decisionToEdit = decision;
      this._editXml = xml.dmnXml;
      this.edit.open(parseDecisionForm(xml.dmnXml));
    });
  }

  public onEditDecision(value: DecisionFormValue): void {
    if (!this._editXml || !this._decisionToEdit) return;

    this.$loading.set(true);

    const patchedXml = updateDmnXml(this._editXml, value);
    const fileName = this._decisionToEdit.resource || toDecisionFileName(this._decisionToEdit.key);
    const file = new File([patchedXml], fileName, {type: 'text/xml'});

    this.decisionService
      .deployBuildingBlockDecisionDefinition(
        this.buildingBlockManagementDetailService.buildingBlockDefinitionKey,
        this.buildingBlockManagementDetailService.buildingBlockDefinitionVersionTag,
        file
      )
      .subscribe({
        next: () => {
          this.notificationService.showToast({
            type: 'success',
            title: this.translateService.instant('decisions.deploySuccess'),
          });
          this.decisionStateService.refreshDecisions();
        },
        error: () => {
          this.notificationService.showToast({
            type: 'error',
            title: this.translateService.instant('decisions.deployFailure'),
          });
          this.$loading.set(false);
        },
      });
  }

  public onDeploySuccessful(): void {
    this.decisionStateService.refreshDecisions();
  }

  public onDeleteConfirm(): void {
    if (!this._decisionToDelete) return;

    this.$loading.set(true);

    this.buildingBlockManagementApiService
      .deleteBuildingBlockDecisionDefinition(
        this.buildingBlockManagementDetailService.buildingBlockDefinitionKey,
        this.buildingBlockManagementDetailService.buildingBlockDefinitionVersionTag,
        this._decisionToDelete.key
      )
      .subscribe({
        next: () => {
          this.notificationService.showToast({
            type: 'success',
            title: this.translateService.instant('decisions.deleteSuccess'),
          });
          this.decisionStateService.refreshDecisions();
        },
        error: () => {
          this.notificationService.showToast({
            type: 'error',
            title: this.translateService.instant('decisions.deleteFailure'),
          });
          this.$loading.set(false);
        },
      });
  }

  private deleteDisabled(): boolean {
    return this._isFinal;
  }
}
