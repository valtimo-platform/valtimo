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

import {ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
  IWidgetManagementService,
  WIDGET_MANAGEMENT_SERVICE,
  WidgetManagementComponent,
  WidgetType,
} from '@valtimo/layout';
import {CaseHeaderWidgetManagementService} from '../../../../services/case-header-widget-management.service';
import {ActivatedRoute} from '@angular/router';
import {CaseManagementParams, getCaseManagementRouteParams} from '@valtimo/shared';
import {Subscription} from 'rxjs';

@Component({
  standalone: true,
  selector: 'valtimo-case-management-header',
  templateUrl: './case-management-header.component.html',
  styleUrls: ['./case-management-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, WidgetManagementComponent],
  providers: [
    {
      provide: WIDGET_MANAGEMENT_SERVICE,
      useClass: CaseHeaderWidgetManagementService,
    },
  ],
})
export class CaseManagementHeaderComponent implements OnInit, OnDestroy {
  public readonly AVAILABLE_WIDGET_TYPES = [WidgetType.FIELDS];

  private readonly _params$ = getCaseManagementRouteParams(this.route);
  private readonly _subscriptions = new Subscription();

  public readonly widgetManagementService = inject(
    WIDGET_MANAGEMENT_SERVICE
  ) as IWidgetManagementService<CaseManagementParams>;

  constructor(private readonly route: ActivatedRoute) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      this._params$.subscribe(params => {
        this.widgetManagementService.initParams(params);
      })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }
}
