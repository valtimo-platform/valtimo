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

import {DatePipe} from '@angular/common';
import {AfterViewInit, Component, ViewEncapsulation} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {ArrowDown16, ArrowUp16, Edit16} from '@carbon/icons';
import {TranslateService} from '@ngx-translate/core';
import {
  ActionItem,
  ColumnConfig,
  PageHeaderService,
  PageTitleService,
  ViewType,
} from '@valtimo/components';
import {DashboardWidgetConfiguration} from '@valtimo/dashboard';
import {IconService} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, map, Observable, switchMap, tap} from 'rxjs';
import {DashboardItem, DashboardWidget, WidgetModalType} from '../../models';
import {DashboardManagementService} from '../../services/dashboard-management.service';

@Component({
  templateUrl: './dashboard-details.component.html',
  styleUrls: ['./dashboard-details.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class DashboardDetailsComponent implements AfterViewInit {
  public modalType: WidgetModalType = 'create';
  public fields!: ColumnConfig[];
  public readonly actionItems: ActionItem[] = [
    {
      label: 'Edit',
      callback: this.editWidget.bind(this),
    },
    {
      label: 'Delete',
      callback: this.deleteWidget.bind(this),
      type: 'danger',
    },
  ];

  private readonly _dashboardKey$ = this.route.params.pipe(map(params => params.id));
  private readonly _refreshDashboardSubject$ = new BehaviorSubject<null>(null);
  public readonly currentDashboard$: Observable<DashboardItem | undefined> = combineLatest([
    this._dashboardKey$,
    this.translateService.stream('key'),
    this._refreshDashboardSubject$,
  ]).pipe(
    switchMap(([dashboardKey]) => this.dashboardManagementService.getDashboard(dashboardKey)),
    tap((currentDashboard: DashboardItem) => {
      if (!currentDashboard) {
        return;
      }

      this.pageTitleService.setCustomPageTitle(currentDashboard.title);
      this.pageTitleService.setCustomPageSubtitle(
        this.translateService.instant('dashboardManagement.widgets.metadata', {
          createdBy: currentDashboard.createdBy,
          createdOn: this.datePipe.transform(currentDashboard.createdOn ?? '', 'd/M/yy, H:mm'),
          key: currentDashboard.key,
        })
      );
    })
  );

  public readonly lastItemIndex$ = new BehaviorSubject<number>(0);
  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly dragAndDropDisabled$ = new BehaviorSubject<boolean>(false);

  public readonly _refreshWidgetsSubject$ = new BehaviorSubject<DashboardWidget[] | null>(null);

  private _widgetData: DashboardWidget[] | null = null;
  public readonly widgetData$: Observable<DashboardWidget[]> = combineLatest([
    this._dashboardKey$,
    this._refreshWidgetsSubject$,
  ]).pipe(
    switchMap(([dashboardKey, refreshWidgets]) => {
      if (!this._widgetData || !refreshWidgets) {
        this.loading$.next(true);
        return this.dashboardManagementService.getDashboardWidgetConfiguration(dashboardKey);
      }

      this.dragAndDropDisabled$.next(true);

      return this.dashboardManagementService.updateDashboardWidgetConfigurations(
        dashboardKey,
        refreshWidgets
      );
    }),
    tap((data: DashboardWidget[]) => {
      this._widgetData = data;
      this.lastItemIndex$.next(data.length - 1);
      this.loading$.next(false);
      this.dragAndDropDisabled$.next(false);
    })
  );

  public readonly showModal$ = new BehaviorSubject<boolean>(false);
  public readonly showEditDashboardModal$ = new BehaviorSubject<boolean>(false);

  public readonly editWidgetConfiguration$ =
    new BehaviorSubject<DashboardWidgetConfiguration | null>(null);

  public readonly compactMode$ = this.pageHeaderService.compactMode$;

  constructor(
    private readonly dashboardManagementService: DashboardManagementService,
    private readonly datePipe: DatePipe,
    private readonly iconService: IconService,
    private readonly pageTitleService: PageTitleService,
    private readonly route: ActivatedRoute,
    private readonly translateService: TranslateService,
    private readonly pageHeaderService: PageHeaderService
  ) {}

  public ngAfterViewInit(): void {
    this.iconService.registerAll([ArrowDown16, ArrowUp16, Edit16]);
    this.setFields();
  }

  public addWidget(): void {
    this.editWidgetConfiguration$.next(null);
    this.modalType = 'create';
    this.showModal();
  }

  public editDashboard(): void {
    this.showEditDashboardModal();
  }

  public refreshWidgets(): void {
    this._refreshWidgetsSubject$.next(null);
  }

  public refreshDashboard(): void {
    this._refreshDashboardSubject$.next(null);
  }

  public onItemsReordered(items: DashboardWidget[]): void {
    if (!items) return;

    this._refreshWidgetsSubject$.next(items);
  }

  public editWidget(event: DashboardWidgetConfiguration): void {
    this.editWidgetConfiguration$.next({...event});
    this.modalType = 'edit';
    this.showModal();
  }

  private setFields(): void {
    this.fields = [
      {
        viewType: ViewType.TEXT,
        key: 'title',
        label: 'Name',
      },
    ];
  }

  private deleteWidget(event: DashboardWidgetConfiguration): void {
    this.editWidgetConfiguration$.next({...event});
    this.modalType = 'delete';
    this.showModal();
  }

  private showModal(): void {
    this.showModal$.next(true);
  }

  private showEditDashboardModal(): void {
    this.showEditDashboardModal$.next(true);
  }
}
