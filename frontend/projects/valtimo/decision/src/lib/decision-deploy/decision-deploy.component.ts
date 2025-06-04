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

import {Component, EventEmitter, Output} from '@angular/core';
import {DecisionService, DecisionStateService} from '../services';
import {ValtimoCdsOverflowButtonDirective} from '@valtimo/components';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {ModalModule} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, switchMap, take} from 'rxjs';
import {getCaseManagementRouteParams, getContextObservable} from '@valtimo/shared';
import {ActivatedRoute} from '@angular/router';

@Component({
  selector: 'valtimo-decision-deploy',
  standalone: true,
  templateUrl: './decision-deploy.component.html',
  styleUrls: ['./decision-deploy.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ModalModule,
    ValtimoCdsOverflowButtonDirective,
    ModalModule,
  ],
})
export class DecisionDeployComponent {
  public dmn: File | null = null;
  @Output() deploySuccessful = new EventEmitter();

  public readonly modalOpen$ = new BehaviorSubject<boolean>(false);

  public readonly caseManagementRouteParams$ = getCaseManagementRouteParams(this.route);
  public readonly context$ = getContextObservable(this.route);

  constructor(
    private readonly decisionService: DecisionService,
    private readonly stateService: DecisionStateService,
    private readonly route: ActivatedRoute
  ) {}

  public onChange(files: FileList): void {
    this.dmn = files.item(0);
  }

  public deployDmn(): void {
    combineLatest([this.caseManagementRouteParams$, this.context$])
      .pipe(
        take(1),
        switchMap(([params, context]) =>
          context === 'case'
            ? this.decisionService.deployCaseDecisionDefinition(
                params.caseDefinitionKey,
                params.caseDefinitionVersionTag,
                this.dmn
              )
            : this.decisionService.deployDmn(this.dmn)
        )
      )
      .subscribe(() => {
        this.closeModal();
        this.deploySuccessful.emit();
        this.stateService.refreshDecisions();
      });
  }

  public openModal() {
    this.modalOpen$.next(true);
  }

  public closeModal(): void {
    this.modalOpen$.next(false);
  }
}
