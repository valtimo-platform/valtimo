import {DatePipe} from '@angular/common';
import {AfterViewInit, Component, TemplateRef, ViewChild, ViewEncapsulation} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {ArrowDown16, ArrowUp16, Edit16} from '@carbon/icons';
import {TranslateService} from '@ngx-translate/core';
import {
  CarbonTableConfig,
  ColumnType,
  createCarbonTableConfig,
  PageTitleService,
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
  @ViewChild('moveButtonsTemplate', {static: false}) moveButtonsTemplate: TemplateRef<any>;

  public modalType: WidgetModalType = 'create';
  public tableConfig!: CarbonTableConfig;

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

  public readonly _refreshWidgetsSubject$ = new BehaviorSubject<{
    direction: 'UP' | 'DOWN';
    index: number;
  } | null>(null);

  private _widgetData: DashboardWidget[] | null = null;
  public readonly widgetData$: Observable<DashboardWidget[]> = combineLatest([
    this._dashboardKey$,
    this._refreshWidgetsSubject$,
  ]).pipe(
    switchMap(([dashboardKey, refreshWidgets]) => {
      this.loading$.next(true);
      if (!this._widgetData || !refreshWidgets) {
        return this.dashboardManagementService.getDashboardWidgetConfiguration(dashboardKey);
      }

      const {direction, index} = refreshWidgets;

      return this.dashboardManagementService.updateDashboardWidgetConfigurations(
        dashboardKey,
        direction === 'UP'
          ? this.swapWidgets(this._widgetData, index - 1, index)
          : this.swapWidgets(this._widgetData, index, index + 1)
      );
    }),
    tap((data: DashboardWidget[]) => {
      this._widgetData = data;
      this.lastItemIndex$.next(data.length - 1);
      this.loading$.next(false);
    })
  );

  public readonly showModal$ = new BehaviorSubject<boolean>(false);
  public readonly showEditDashboardModal$ = new BehaviorSubject<boolean>(false);

  public readonly editWidgetConfiguration$ =
    new BehaviorSubject<DashboardWidgetConfiguration | null>(null);

  constructor(
    private readonly dashboardManagementService: DashboardManagementService,
    private readonly datePipe: DatePipe,
    private readonly iconService: IconService,
    private readonly pageTitleService: PageTitleService,
    private readonly route: ActivatedRoute,
    private readonly translateService: TranslateService
  ) {}

  public ngAfterViewInit(): void {
    this.iconService.registerAll([ArrowDown16, ArrowUp16, Edit16]);
    this.setTableConfig();
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

  public onArrowDownClick(data: {item: DashboardWidget; index: number}): void {
    this._refreshWidgetsSubject$.next({direction: 'DOWN', index: data.index});
  }

  public onArrowUpClick(data: {item: DashboardWidget; index: number}): void {
    this._refreshWidgetsSubject$.next({direction: 'UP', index: data.index});
  }

  private setTableConfig(): void {
    this.tableConfig = createCarbonTableConfig({
      fields: [
        {
          columnType: ColumnType.TEXT,
          fieldName: 'title',
          translationKey: 'Name',
        },
        {
          columnType: ColumnType.TEMPLATE,
          template: this.moveButtonsTemplate,
          className: 'dashboard-detail-table__actions',
          fieldName: '',
          translationKey: '',
        },
        {
          columnType: ColumnType.ACTION,
          className: 'dashboard-detail-table__actions',
          fieldName: '',
          translationKey: '',
          actions: [
            {
              actionName: 'Edit',
              callback: this.editWidget.bind(this),
            },
            {
              actionName: 'Delete',
              callback: this.deleteWidget.bind(this),
              type: 'danger',
            },
          ],
        },
      ],
    });
  }

  private editWidget(event: DashboardWidgetConfiguration): void {
    this.editWidgetConfiguration$.next({...event});
    this.modalType = 'edit';
    this.showModal();
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

  private swapWidgets(
    dashboardWidgets: DashboardWidget[],
    index1: number,
    index2: number
  ): DashboardWidget[] {
    const temp = [...dashboardWidgets];
    temp[index1] = temp.splice(index2, 1, temp[index1])[0];

    return temp;
  }
}
