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

import {AfterViewInit, Component, OnDestroy} from '@angular/core';
import {BreadcrumbService, PageHeaderService, PageTitleService} from '@valtimo/components';
import {BehaviorSubject, combineLatest, filter, map, Observable, switchMap, tap} from 'rxjs';
import {TabManagementService, WidgetTabManagementService} from '../../services';
import {ActivatedRoute} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {Edit16} from '@carbon/icons';
import {IconService} from 'carbon-components-angular';
import {ApiTabItem} from '@valtimo/dossier';
import moment from 'moment/moment';

@Component({
  selector: 'valtimo-dossier-management-case-widgets',
  templateUrl: './dossier-management-widget-tab.component.html',
})
export class DossierManagementWidgetTabComponent implements AfterViewInit, OnDestroy {
  public readonly documentDefinitionName$: Observable<string> = this.route.params.pipe(
    map(params => params.name || ''),
    filter(documentDefinitionName => !!documentDefinitionName),
    tap(documentDefinitionName =>
      this.tabManagementService.setCaseDefinitionId(documentDefinitionName)
    )
  );

  public readonly tabWidgetKey$: Observable<string> = this.route.params.pipe(
    map(params => params.key || ''),
    filter(tabWidgetKey => !!tabWidgetKey)
  );

  private readonly _refreshWidgetTabSubject$ = new BehaviorSubject<null>(null);
  public readonly showEditWidgetTabModal$ = new BehaviorSubject<boolean>(false);
  public readonly currentWidgetTabItem$: Observable<ApiTabItem> = combineLatest([
    this.tabWidgetKey$,
    this.translateService.stream('key'),
    this._refreshWidgetTabSubject$,
  ]).pipe(
    switchMap(([tabKey]) => this.tabManagementService.getTab(tabKey)),
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

  public readonly compactMode$ = this.pageHeaderService.compactMode$;
  constructor(
    private readonly breadcrumbService: BreadcrumbService,
    private readonly iconService: IconService,
    private readonly pageTitleService: PageTitleService,
    private readonly route: ActivatedRoute,
    private readonly tabManagementService: TabManagementService,
    private readonly widgetTabManagementService: WidgetTabManagementService,
    private readonly translateService: TranslateService,
    private readonly pageHeaderService: PageHeaderService
  ) {}

  public ngAfterViewInit(): void {
    this.iconService.registerAll([Edit16]);
    this.initBreadcrumb();
  }

  public ngOnDestroy(): void {
    this.breadcrumbService.clearThirdBreadcrumb();
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

  private initBreadcrumb(): void {
    this.documentDefinitionName$.subscribe(documentDefinitionName => {
      this.breadcrumbService.setThirdBreadcrumb({
        route: [`/dossier-management/dossier/${documentDefinitionName}`],
        content: documentDefinitionName,
        href: `/dossier-management/dossier/${documentDefinitionName}`,
      });
    });
  }
}
