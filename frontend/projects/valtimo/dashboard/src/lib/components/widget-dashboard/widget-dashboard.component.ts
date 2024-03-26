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
import {Component, ViewEncapsulation} from '@angular/core';
import {BehaviorSubject, Observable, take, tap} from 'rxjs';
import {Dashboard, WidgetData} from '../../models';
import {DashboardService} from '../../services';
import {WidgetApiService} from '../../services/widget-api.service';

@Component({
  selector: 'valtimo-widget-dashboard',
  templateUrl: './widget-dashboard.component.html',
  styleUrls: ['./widget-dashboard.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class WidgetDashboardComponent {
  public dashboards$: Observable<Array<Dashboard>> = this.dashboardService.getDashboards().pipe(
    tap(dashboards => {
      if (dashboards.length === 1) {
        this.onTabSelected(dashboards[0].key);
      }
    })
  );
  public readonly activeWidgetData$ = new BehaviorSubject<{data: WidgetData[]; loading: boolean}>({
    data: [],
    loading: true,
  });

  constructor(
    private readonly dashboardService: DashboardService,
    private readonly widgetApiService: WidgetApiService
  ) {}

  public onTabSelected(dashboardKey: string): void {
    this.widgetApiService
      .getWidgetData(dashboardKey)
      .pipe(
        tap(() => {
          this.activeWidgetData$.next({data: [], loading: true});
        }),
        take(1)
      )
      .subscribe((data: WidgetData[]) => this.activeWidgetData$.next({data, loading: false}));
  }

  public trackByIndex(index: number): number {
    return index;
  }
}
