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
import {Decision} from '../models';
import {filterLatestDecisionVersions} from '../utils/decision.utils';
import {DecisionService} from '../services/decision.service';
import {
  ConfigService,
  EditPermissionsService,
  getBuildingBlockManagementRouteParams,
  getCaseManagementRouteParams,
  getContextObservable,
} from '@valtimo/shared';
import {DecisionStateService} from '../services';
import {DecisionDeployComponent} from '../decision-deploy/decision-deploy.component';
import {DECISION_LIST_TEST_IDS} from '../constants';
import {CarbonListModule, WidgetModule} from '@valtimo/components';
import {ButtonModule, IconModule, IconService} from 'carbon-components-angular';
import {Upload16} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';

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
    TranslateModule,
    ButtonModule,
  ],
})
export class DecisionListComponent {
  @ViewChild('decisionDeploy') deploy: DecisionDeployComponent;

  public fields = [
    {key: 'key', label: 'Key'},
    {key: 'name', label: 'Name'},
    {key: 'version', label: 'Version'},
  ];

  readonly loading$ = new BehaviorSubject<boolean>(true);
  readonly experimentalEditing$ =
    this.configService.getFeatureToggleObservable('experimentalDmnEditing');

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
      return this.decisionService.getDecisions();
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

  constructor(
    private readonly decisionService: DecisionService,
    private readonly iconService: IconService,
    private readonly router: Router,
    private readonly configService: ConfigService,
    private readonly stateService: DecisionStateService,
    private readonly route: ActivatedRoute,
    private readonly cdr: ChangeDetectorRef,
    private readonly editPermissionsService: EditPermissionsService
  ) {
    this.iconService.registerAll([Upload16]);
  }

  public viewDecisionTable(decision: Decision): void {
    combineLatest([this.context$, this.experimentalEditing$])
      .pipe(take(1))
      .subscribe(([context, experimentalEditing]) => {
      if (context === 'independent') {
        const basePath = experimentalEditing ? '/decision-tables/edit/' : '/decision-tables/';
        this.router.navigate([basePath + decision.id]);
      } else if (context === 'buildingBlock') {
        this.buildingBlockManagementRouteParams$.pipe(take(1)).subscribe(params => {
          this.router.navigateByUrl(
            `building-block-management/building-block/${params.buildingBlockDefinitionKey}/version/${params.buildingBlockDefinitionVersionTag}/decisions/${decision.id}`
          );
        });
      } else {
        this.caseManagementRouteParams$.pipe(take(1)).subscribe(params => {
          this.router.navigateByUrl(
            `case-management/case/${params.caseDefinitionKey}/version/${params.caseDefinitionVersionTag}/decisions/${decision.id}`
          );
        });
      }
    });
  }
}
