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
import {ActivatedRoute, Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {getCaseManagementRouteParams} from '@valtimo/shared';
import {LoadingModule, NotificationModule} from 'carbon-components-angular';
import {isEqual} from 'lodash';
import {BehaviorSubject, combineLatest, Subscription, switchMap} from 'rxjs';
import {distinctUntilChanged, filter} from 'rxjs/operators';
import {ProcessDefinitionResult} from '../../models';
import {ProcessManagementService} from '../../services';
import {getContextObservable} from '../../utils';
import {ProcessManagementBuilderComponent} from '../process-management-builder/process-management-builder.component';
import {ProcessManagementListComponent} from '../process-management-list/process-management-list.component';
import {ProcessManagementUploadComponent} from '../process-management-upload/process-management-upload.component';

@Component({
  selector: 'valtimo-process-management',
  templateUrl: './process-management.component.html',
  styleUrls: ['./process-management.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    ProcessManagementListComponent,
    ProcessManagementUploadComponent,
    ProcessManagementBuilderComponent,
    LoadingModule,
    NotificationModule,
  ],
  providers: [TranslateService],
})
export class ProcessManagementComponent implements OnInit, OnDestroy {
  public readonly context$ = getContextObservable(this.route);

  public readonly params$ = this.context$.pipe(
    filter(context => context === 'case'),
    switchMap(() => getCaseManagementRouteParams(this.route)),
    distinctUntilChanged((previous, current) => isEqual(previous, current))
  );

  public readonly paramsAreSet$ = new BehaviorSubject<boolean>(false);

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly processManagementService: ProcessManagementService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  public ngOnInit(): void {
    this.openParamsAndContextSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onProcessSelected(selectedProcessEvent: ProcessDefinitionResult | 'create'): void {
    const editParam =
      selectedProcessEvent === 'create' ? 'create' : selectedProcessEvent?.processDefinition?.key;

    this.router.navigate([editParam], {
      relativeTo: this.route,
    });
  }

  private openParamsAndContextSubscription(): void {
    this._subscriptions.add(
      combineLatest([this.context$, this.params$]).subscribe(([context, params]) => {
        if (context) this.processManagementService.context = context;

        if (params) {
          this.processManagementService.setParams(
            params.caseDefinitionKey,
            params.caseDefinitionVersionTag
          );
        }

        this.paramsAreSet$.next(true);
      })
    );
  }
}
