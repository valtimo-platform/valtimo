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
import {ChangeDetectionStrategy, Component, Inject, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {
  IWidgetManagementService,
  ManagementWidgetDetailsComponent,
  WIDGET_MANAGEMENT_SERVICE,
  WidgetManagementComponent,
  WidgetType,
  WidgetWizardService,
  WidgetWizardStep,
} from '@valtimo/layout';
import {CaseManagementParams, getCaseManagementRouteParams} from '@valtimo/shared';
import {Subscription} from 'rxjs';
import {CaseHeaderWidgetManagementService} from '../../../../services/case-header-widget-management.service';

@Component({
  standalone: true,
  selector: 'valtimo-case-management-header',
  templateUrl: './case-management-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, WidgetManagementComponent],
  providers: [
    {
      provide: WIDGET_MANAGEMENT_SERVICE,
      useClass: CaseHeaderWidgetManagementService,
    },
  ],
})
export class CaseManagementHeaderComponent
  extends ManagementWidgetDetailsComponent
  implements OnInit, OnDestroy
{
  public readonly AVAILABLE_WIDGET_TYPES = [WidgetType.FIELDS];
  public readonly WIDGET_WIZARD_STEPS = [
    WidgetWizardStep.TYPE,
    WidgetWizardStep.CONTENT,
  ];

  private readonly _params$ = getCaseManagementRouteParams(this.route);
  private readonly _subscriptions = new Subscription();

  constructor(
    protected readonly widgetWizardService: WidgetWizardService,
    @Inject(WIDGET_MANAGEMENT_SERVICE)
    private readonly widgetManagementService: IWidgetManagementService<CaseManagementParams>,
    private readonly route: ActivatedRoute
  ) {
    super(widgetWizardService);
  }

  public ngOnInit(): void {
    this._subscriptions.add(
      this._params$.subscribe(params => {
        this.widgetManagementService.initParams(params);
        this.setContext('case');
        this.widgetWizardService.$disableActionButton.set(true);
        this.setTitleDisabled(true);
      })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this.widgetWizardService.$disableActionButton.set(false);
    this.setTitleDisabled(false);
  }
}
