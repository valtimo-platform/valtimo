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
import {ActivatedRoute, Params} from '@angular/router';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {BreadcrumbService} from '@valtimo/components';
import {
  BasicWidget,
  IWidgetManagementService,
  WIDGET_MANAGEMENT_SERVICE,
  WidgetManagementComponent,
  WidgetType,
} from '@valtimo/layout';
import {combineLatest, map, Observable, Subscription, switchMap, tap} from 'rxjs';
import {IkoManagementParams, IkoRepositoryConfigResponse, TabDto} from '../../../../models';
import {IkoManagementApiService, IkoWidgetManagementApiService} from '../../../../services';

@Component({
  templateUrl: './iko-management-widgets.component.html',
  styleUrl: './iko-management-widgets.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, WidgetManagementComponent, TranslateModule],
  providers: [
    {
      provide: WIDGET_MANAGEMENT_SERVICE,
      useClass: IkoWidgetManagementApiService,
    },
  ],
})
export class IkoManagementWidgetsComponent implements OnInit, OnDestroy {
  public readonly params$: Observable<IkoManagementParams> = this.route.params.pipe(
    map((params: Params) => ({
      apiKey: params.apiKey,
      aggregateKey: params.key,
      actionKey: params.actionKey,
      tabKey: params.tabKey,
      widgetTabKey: params.widgetTabKey,
    })),
    tap((params: IkoManagementParams) => this.ikoWidgetManagementApiService.initParams(params))
  );

  public readonly widgets$: Observable<BasicWidget[]> =
    this.ikoWidgetManagementApiService.getWidgetConfiguration();

  public readonly AVAILABLE_WIDGET_TYPES = [
    WidgetType.FIELDS,
    WidgetType.COLLECTION,
    WidgetType.TABLE,
    WidgetType.INTERACTIVE_TABLE,
  ];

  private readonly _ikoRepositoryConfig$: Observable<IkoRepositoryConfigResponse> =
    this.params$.pipe(
      switchMap((params: Params) =>
        this.ikoManagementApiService.getIkoRepositoryConfig(params.apiKey)
      )
    );

  private readonly _ikoTabConfig$: Observable<TabDto> = this.params$.pipe(
    switchMap((params: Params) =>
      this.ikoManagementApiService.getIkoTab(params.aggregateKey, params.widgetTabKey)
    )
  );

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly breadcrumbService: BreadcrumbService,
    private readonly ikoManagementApiService: IkoManagementApiService,
    private readonly route: ActivatedRoute,
    private readonly translateService: TranslateService,
    @Inject(WIDGET_MANAGEMENT_SERVICE)
    private ikoWidgetManagementApiService: IWidgetManagementService<IkoManagementParams>
  ) {}

  public ngOnInit(): void {
    this.setBreadcrumbs();
  }

  public ngOnDestroy(): void {
    this.breadcrumbService.clearThirdBreadcrumb();
    this.breadcrumbService.clearFourthBreadcrumb();
    this._subscriptions.unsubscribe();
  }

  private setBreadcrumbs(): void {
    this._subscriptions.add(
      combineLatest([
        this._ikoTabConfig$,
        this._ikoRepositoryConfig$,
        this.ikoWidgetManagementApiService.params$,
        this.translateService.stream('key'),
      ])
        .pipe(
          tap(([tabConfig, repositoryConfig, params]) => {
            if (!params) return;

            this.breadcrumbService.setThirdBreadcrumb({
              route: [`/iko-management/${repositoryConfig.key}`],
              content: repositoryConfig.title,
              href: `/iko-management/${repositoryConfig.key}`,
            });

            this.breadcrumbService.setFourthBreadcrumb({
              route: [
                `/iko-management/${repositoryConfig.key}/${params.aggregateKey}/${params.tabKey}`,
              ],
              content: tabConfig.title || params.widgetTabKey || '',
              href: `/iko-management/${repositoryConfig.key}/${params.aggregateKey}/${params.tabKey}`,
            });
          })
        )
        .subscribe()
    );
  }
}
