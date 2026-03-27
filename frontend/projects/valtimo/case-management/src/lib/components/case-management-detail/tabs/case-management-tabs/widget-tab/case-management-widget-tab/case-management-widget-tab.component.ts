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
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  Inject,
  OnDestroy,
  OnInit,
} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Edit16} from '@carbon/icons';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {ApiTabItem} from '@valtimo/case';
import {
  BreadcrumbService,
  PageHeaderService,
  PageTitleService,
  RenderInPageHeaderDirective,
} from '@valtimo/components';
import {
  IWidgetManagementService,
  ManagementWidgetDetailsComponent,
  WIDGET_MANAGEMENT_SERVICE,
  WidgetManagementComponent,
  WidgetType,
  WidgetWizardService,
} from '@valtimo/layout';
import {CaseManagementParams, getCaseManagementRouteParams} from '@valtimo/shared';
import {ButtonModule, IconModule, IconService, TabsModule} from 'carbon-components-angular';
import moment from 'moment/moment';
import {BehaviorSubject, combineLatest, filter, map, Observable, switchMap, tap} from 'rxjs';

import {TabManagementService, CaseWidgetManagementApiService} from '../../../../../../services';
import {CaseManagementWidgetTabEditModalComponent} from '../case-management-widget-tab-edit-modal/case-management-widget-tab-edit-modal.component';

@Component({
  templateUrl: './case-management-widget-tab.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    CaseManagementWidgetTabEditModalComponent,
    RenderInPageHeaderDirective,
    ButtonModule,
    IconModule,
    TabsModule,
    WidgetManagementComponent,
  ],
  providers: [
    {
      provide: WIDGET_MANAGEMENT_SERVICE,
      useClass: CaseWidgetManagementApiService,
    },
  ],
})
export class CaseManagementWidgetTabComponent
  extends ManagementWidgetDetailsComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  public readonly caseManagementRouteParams$ = getCaseManagementRouteParams(this.route).pipe(
    tap(params => {
      this.tabManagementService.setParams(params);
      this.tabManagementService.loadTabs();
    }),
    map(
      (params: CaseManagementParams | undefined) =>
        params ?? {caseDefinitionKey: '', caseDefinitionVersionTag: ''}
    )
  );

  public readonly tabWidgetKey$: Observable<string> = this.route.params.pipe(
    map(params => params.key || '')
  );

  public readonly params$ = combineLatest([
    this.caseManagementRouteParams$,
    this.tabWidgetKey$,
  ]).pipe(
    filter(([caseManagementRouteParams, key]) => !!caseManagementRouteParams && !!key),
    map(([caseManagementRouteParams, key]) => ({
      ...caseManagementRouteParams,
      key,
    }))
  );

  private readonly _refreshWidgetTabSubject$ = new BehaviorSubject<null>(null);
  public readonly showEditWidgetTabModal$ = new BehaviorSubject<boolean>(false);
  public readonly currentWidgetTabItem$: Observable<ApiTabItem> = combineLatest([
    this.params$,
    this.translateService.stream('key'),
    this._refreshWidgetTabSubject$,
  ]).pipe(
    switchMap(([params]) => this.tabManagementService.getTab(params.key)),
    tap(tabItem => {
      const title =
        tabItem.name ||
        this.translateService.instant(`widgetTabManagement.metadata.${tabItem.key}`);
      this.pageTitleService.setCustomPageTitle(title);
      this.pageTitleService.setCustomPageSubtitle(
        this.translateService.instant('widgetTabManagement.tab.metadata', {
          createdBy: tabItem?.createdBy || '-',
          createdOn: !!tabItem?.createdOn
            ? moment(tabItem?.createdOn).format('DD MMM YYYY HH:mm')
            : '-',
          key: tabItem.key,
        })
      );
    })
  );

  public readonly currentWidgetTab$ = combineLatest([
    this.caseWidgetManagementApiService.params$,
    this._refreshWidgetTabSubject$,
  ]).pipe(
    filter(([params]) => !!params),
    switchMap(() => this.caseWidgetManagementApiService.getWidgetConfiguration())
  );

  public readonly compactMode$ = this.pageHeaderService.compactMode$;
  public readonly AVAILABLE_WIDGET_TYPES = [
    WidgetType.FIELDS,
    WidgetType.COLLECTION,
    WidgetType.CUSTOM,
    WidgetType.FORMIO,
    WidgetType.TABLE,
    WidgetType.MAP,
    WidgetType.PROGRESS,
  ];

  constructor(
    protected readonly widgetWizardService: WidgetWizardService,
    private readonly breadcrumbService: BreadcrumbService,
    private readonly iconService: IconService,
    private readonly pageTitleService: PageTitleService,
    private readonly route: ActivatedRoute,
    private readonly tabManagementService: TabManagementService,
    @Inject(WIDGET_MANAGEMENT_SERVICE)
    private readonly caseWidgetManagementApiService: IWidgetManagementService<
      CaseManagementParams & {key: string}
    >,
    private readonly translateService: TranslateService,
    private readonly pageHeaderService: PageHeaderService
  ) {
    super(widgetWizardService);
  }

  public ngOnInit(): void {
    this.setContext('case');
    this.pageTitleService.enableReset();
  }

  public ngAfterViewInit(): void {
    this.iconService.registerAll([Edit16]);
    this.initBreadcrumbs();
  }

  public ngOnDestroy(): void {
    this.breadcrumbService.clearThirdBreadcrumb();
    this.breadcrumbService.clearFourthBreadcrumb();
    this.pageTitleService.disableReset();
  }

  public editWidgetTab(): void {
    this.showEditWidgetTabModal();
  }

  private showEditWidgetTabModal(): void {
    this.showEditWidgetTabModal$.next(true);
  }

  public refreshWidgetTab(): void {
    this._refreshWidgetTabSubject$.next(null);
  }

  private initBreadcrumbs(): void {
    this.caseManagementRouteParams$.subscribe(params => {
      const route = `/case-management/case/${params.caseDefinitionKey}/version/${params.caseDefinitionVersionTag}`;

      this.breadcrumbService.setThirdBreadcrumb({
        route: [route],
        content: `${params.caseDefinitionKey} (${params.caseDefinitionVersionTag})`,
        href: route,
      });

      this.breadcrumbService.setFourthBreadcrumb({
        route: [`${route}/case-details`],
        content: this.translateService.instant('caseManagement.tabs.caseDetailsTab.title'),
        href: `${route}/case-details`,
      });
    });
  }
}
