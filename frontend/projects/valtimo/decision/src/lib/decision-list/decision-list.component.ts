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

import {ChangeDetectorRef, Component, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ActivatedRoute, Router, RouterModule} from '@angular/router';
import {BehaviorSubject, combineLatest, map, Observable, switchMap, take, tap} from 'rxjs';
import {DecisionFormValue, Decision} from '../models';
import {filterLatestDecisionVersions} from '../utils/decision.utils';
import {parseDecisionForm, toDecisionFileName, updateDmnXml} from '../utils/dmn-template';
import {DecisionService} from '../services/decision.service';
import {
  EditPermissionsService,
  getBuildingBlockManagementRouteParams,
  getCaseManagementRouteParams,
  getContextObservable,
  GlobalNotificationService,
  ManagementContext,
} from '@valtimo/shared';
import {DecisionStateService} from '../services';
import {DecisionDeployComponent} from '../decision-deploy/decision-deploy.component';
import {DecisionFormModalComponent} from '../decision-form-modal/decision-form-modal.component';
import {DECISION_LIST_TEST_IDS} from '../constants';
import {
  ActionItem,
  CarbonListModule,
  ConfirmationModalModule,
  WidgetModule,
} from '@valtimo/components';
import {ButtonModule, IconModule, IconService} from 'carbon-components-angular';
import {Add16, Upload16} from '@carbon/icons';
import {TranslateModule, TranslateService} from '@ngx-translate/core';

@Component({
  selector: 'valtimo-decision-list',
  standalone: true,
  templateUrl: './decision-list.component.html',
  styleUrls: ['./decision-list.component.scss'],
  imports: [
    CommonModule,
    RouterModule,
    CarbonListModule,
    IconModule,
    WidgetModule,
    DecisionDeployComponent,
    DecisionFormModalComponent,
    ConfirmationModalModule,
    TranslateModule,
    ButtonModule,
  ],
})
export class DecisionListComponent {
  @ViewChild('decisionDeploy') deploy: DecisionDeployComponent;
  @ViewChild('decisionCreate') create: DecisionFormModalComponent;
  @ViewChild('decisionEdit') edit: DecisionFormModalComponent;

  public fields = [
    {key: 'key', label: 'Key'},
    {key: 'name', label: 'Name'},
    {key: 'version', label: 'Version'},
  ];

  public readonly ACTION_ITEMS: ActionItem[] = [
    {
      label: 'interface.edit',
      callback: this.openEditModal.bind(this),
      type: 'normal',
      disabled$: () => this.hasEditPermissions$.pipe(map(canEdit => !canEdit)),
    },
    {
      label: 'interface.delete',
      callback: this.onDeleteClick.bind(this),
      type: 'danger',
      disabled$: () =>
        this.hasEditPermissions$.pipe(map(canEdit => !canEdit || this._context !== 'case')),
    },
  ];

  public readonly showDeleteModal$ = new BehaviorSubject<boolean>(false);

  readonly loading$ = new BehaviorSubject<boolean>(true);

  protected readonly testIds = DECISION_LIST_TEST_IDS;

  public readonly caseManagementRouteParams$ = getCaseManagementRouteParams(this.route);
  public readonly buildingBlockManagementRouteParams$ =
    getBuildingBlockManagementRouteParams(this.route);
  public readonly context$ = getContextObservable(this.route);

  readonly decisionsLatestVersions$ = this.stateService.refreshDecisions$.pipe(
    switchMap(() => this.context$),
    switchMap(context => {
      if (context === 'case') {
        return this.caseManagementRouteParams$.pipe(
          switchMap(params =>
            this.decisionService.listCaseDecisionDefinitions(
              params.caseDefinitionKey,
              params.caseDefinitionVersionTag
            )
          )
        );
      }
      if (context === 'buildingBlock') {
        return this.buildingBlockManagementRouteParams$.pipe(
          switchMap(params =>
            this.decisionService.listBuildingBlockDecisionDefinitions(
              params.buildingBlockDefinitionKey,
              params.buildingBlockDefinitionVersionTag
            )
          )
        );
      }
      return this.decisionService.getUnlinkedDecisions();
    }),
    map(filterLatestDecisionVersions),
    tap(() => {
      this.loading$.next(false);
      this.cdr.detectChanges();
    })
  );

  public readonly hasEditPermissions$: Observable<boolean> = combineLatest([
    this.caseManagementRouteParams$,
    this.context$,
  ]).pipe(
    switchMap(([params, context]) => {
      return this.editPermissionsService.hasPermissionsToEditBasedOnContext(params, context);
    })
  );

  private _editDecision: Decision | null = null;
  private _editXml: string | null = null;
  private _decisionToDelete: Decision | null = null;
  private _context: ManagementContext | null = null;

  constructor(
    private readonly decisionService: DecisionService,
    private readonly iconService: IconService,
    private readonly router: Router,
    private readonly stateService: DecisionStateService,
    private readonly route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
    private readonly editPermissionsService: EditPermissionsService,
    private readonly notificationService: GlobalNotificationService,
    private readonly translateService: TranslateService
  ) {
    this.iconService.registerAll([Upload16, Add16]);
    this.context$.pipe(take(1)).subscribe(context => (this._context = context));
  }

  public viewDecisionTable(decision: Decision): void {
    this.context$.pipe(take(1)).subscribe(context => {
      if (context === 'buildingBlock') {
        this.buildingBlockManagementRouteParams$.pipe(take(1)).subscribe(params => {
          this.router.navigateByUrl(
            `building-block-management/building-block/${params.buildingBlockDefinitionKey}/version/${params.buildingBlockDefinitionVersionTag}/decisions/${decision.id}`
          );
        });
      } else if (context === 'case') {
        this.caseManagementRouteParams$.pipe(take(1)).subscribe(params => {
          this.router.navigateByUrl(
            `case-management/case/${params.caseDefinitionKey}/version/${params.caseDefinitionVersionTag}/decisions/${decision.id}`
          );
        });
      } else {
        this.router.navigate(['/decision-tables/edit/' + decision.id]);
      }
    });
  }

  public onCreateDecision(value: DecisionFormValue): void {
    const state = {decisionName: value.name, inputVariables: value.inputVariables};

    this.context$.pipe(take(1)).subscribe(context => {
      if (context === 'buildingBlock') {
        this.buildingBlockManagementRouteParams$.pipe(take(1)).subscribe(params => {
          this.router.navigateByUrl(
            `building-block-management/building-block/${params.buildingBlockDefinitionKey}/version/${params.buildingBlockDefinitionVersionTag}/decisions/create`,
            {state}
          );
        });
      } else if (context === 'case') {
        this.caseManagementRouteParams$.pipe(take(1)).subscribe(params => {
          this.router.navigateByUrl(
            `case-management/case/${params.caseDefinitionKey}/version/${params.caseDefinitionVersionTag}/decisions/create`,
            {state}
          );
        });
      } else {
        this.router.navigate(['/decision-tables/edit/create'], {state});
      }
    });
  }

  public openEditModal(decision: Decision): void {
    this.decisionService
      .getDecisionXml(decision.id)
      .pipe(take(1))
      .subscribe(xml => {
        this._editDecision = decision;
        this._editXml = xml.dmnXml;
        this.edit.open(parseDecisionForm(xml.dmnXml));
      });
  }

  public onEditDecision(value: DecisionFormValue): void {
    if (!this._editXml || !this._editDecision) return;

    const patchedXml = updateDmnXml(this._editXml, value);
    const fileName = this._editDecision.resource || toDecisionFileName(this._editDecision.key);
    const file = new File([patchedXml], fileName, {type: 'text/xml'});

    this.deployFileForContext(file).subscribe({
      next: () => {
        this.showNotification('success', 'decisions.deploySuccess');
        this.stateService.refreshDecisions();
      },
      error: () => this.showNotification('error', 'decisions.deployFailure'),
    });
  }

  public onDeleteClick(decision: Decision): void {
    this._decisionToDelete = decision;
    this.showDeleteModal$.next(true);
  }

  public onDeleteConfirm(): void {
    if (!this._decisionToDelete) return;

    const decisionKey = this._decisionToDelete.key;

    this.caseManagementRouteParams$
      .pipe(
        take(1),
        switchMap(params =>
          this.decisionService.deleteCaseDecisionDefinition(
            params.caseDefinitionKey,
            params.caseDefinitionVersionTag,
            decisionKey
          )
        )
      )
      .subscribe({
        next: () => {
          this.showNotification('success', 'decisions.deleteSuccess');
          this.stateService.refreshDecisions();
        },
        error: () => this.showNotification('error', 'decisions.deleteFailure'),
      });
  }

  private deployFileForContext(file: File): Observable<{identifier: string}> {
    return this.context$.pipe(
      take(1),
      switchMap(context => {
        if (context === 'case') {
          return this.caseManagementRouteParams$.pipe(
            take(1),
            switchMap(params =>
              this.decisionService.deployCaseDecisionDefinition(
                params.caseDefinitionKey,
                params.caseDefinitionVersionTag,
                file
              )
            )
          );
        }
        if (context === 'buildingBlock') {
          return this.buildingBlockManagementRouteParams$.pipe(
            take(1),
            switchMap(params =>
              this.decisionService.deployBuildingBlockDecisionDefinition(
                params.buildingBlockDefinitionKey,
                params.buildingBlockDefinitionVersionTag,
                file
              )
            )
          );
        }
        return this.decisionService.deployDmn(file);
      })
    );
  }

  private showNotification(type: 'success' | 'error', message: string): void {
    this.notificationService.showToast({
      caption: this.translateService.instant(message),
      type,
      title: this.translateService.instant(`interface.${type}`),
    });
  }
}
