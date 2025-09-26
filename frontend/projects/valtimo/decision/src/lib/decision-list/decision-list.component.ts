/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

import {Component, ViewChild} from '@angular/core';
import {Decision} from '../models';
import {DecisionService} from '../decision.service';
import {Router} from '@angular/router';
import {BehaviorSubject, map, switchMap, tap} from 'rxjs';
import {ConfigService} from '@valtimo/config';
import {DecisionStateService} from '../services';
import {DecisionDeployComponent} from '../decision-deploy/decision-deploy.component';
import {IconService} from 'carbon-components-angular';
import {Upload16} from '@carbon/icons';

@Component({
  selector: 'valtimo-decision-list',
  templateUrl: './decision-list.component.html',
  styleUrls: ['./decision-list.component.scss'],
})
export class DecisionListComponent {
  @ViewChild('decisionDeploy') deploy: DecisionDeployComponent;

  public fields = [
    {key: 'key', label: 'Key'},
    {key: 'name', label: 'Name'},
    {key: 'version', label: 'Version'},
  ];

  readonly loading$ = new BehaviorSubject<boolean>(true);

  readonly experimentalEditing!: boolean;

  readonly decisionsLatestVersions$ = this.stateService.refreshDecisions$.pipe(
    switchMap(() => this.decisionService.getDecisions()),
    map(decisions =>
      decisions.reduce((acc, curr) => {
        const findInAcc = acc.find(decision => decision.key === curr.key);

        if (findInAcc && findInAcc.version > curr.version) {
          return acc;
        } else if (findInAcc && findInAcc.version < curr.version) {
          const newAcc = acc.filter(decision => decision.key !== curr.key);
          return [...newAcc, curr];
        }

        return [...acc, curr];
      }, [])
    ),
    tap(() => this.loading$.next(false))
  );

  constructor(
    private decisionService: DecisionService,
    private readonly iconService: IconService,
    private router: Router,
    private readonly configService: ConfigService,
    private readonly stateService: DecisionStateService
  ) {
    this.iconService.registerAll([Upload16]);
    this.experimentalEditing = this.configService.config.featureToggles.experimentalDmnEditing;
  }

  viewDecisionTable(decision: Decision) {
    if (this.experimentalEditing) {
      this.router.navigate(['/decision-tables/edit', decision.id]);
    } else {
      this.router.navigate(['/decision-tables', decision.id]);
    }
  }
}
