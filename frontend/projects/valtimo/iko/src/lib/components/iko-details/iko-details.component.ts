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
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {
  BreadcrumbService,
  PageTitleService,
  RenderInPageHeaderDirective,
} from '@valtimo/components';
import {TabsModule} from 'carbon-components-angular';
import {combineLatest, Observable, switchMap, tap} from 'rxjs';
import {IkoTab} from '../../models';
import {IkoApiService, IkoTabService} from '../../services';
import {IkoTabComponents, TabComponentTypes} from '../tabs/tabs.constants';

@Component({
  templateUrl: './iko-details.component.html',
  styleUrl: './iko-details.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TabsModule, RenderInPageHeaderDirective, ...[IkoTabComponents]],
})
export class IkoDetailsComponent implements OnDestroy {
  @ViewChild('content', {read: ViewContainerRef, static: true})
  private readonly _container: ViewContainerRef;

  public readonly activeTabKey$ = this.ikoTabService.activeTabKey$;

  public readonly tabs$: Observable<IkoTab[]> = combineLatest([
    this.route.params,
    this.route.queryParams,
    this.translateService.stream('interface.results'),
    this.ikoApiService.cachedMenuItems$,
  ]).pipe(
    tap(([params, queryParams, breadcrumbTitle, menuItems]) => {
      const currentMenuItem = menuItems.find(item => item.key === params.key);

      if (currentMenuItem && currentMenuItem?.title)
        this.pageTitleService.setCustomPageTitle(currentMenuItem.title, true);

      this.breadcrumbService.setSecondBreadcrumb({
        route: [`/iko/${params.key}`],
        content: currentMenuItem?.title ?? '',
        href: `/iko/${params.key}`,
      });

      this.breadcrumbService.setThirdBreadcrumb({
        content: breadcrumbTitle,
        route: [`/iko/${params.key}/${params.searchKey}`],
        href: `/iko/${params.key}/${params.searchKey}`,
        routeExtras: {queryParams},
      });
      this.ikoTabService.setDataAggregateKey(params.key);
      this.ikoTabService.setEntryId(params.id);
    }),
    switchMap(([params]) => this.ikoApiService.getIkoDetailTabs(params.key)),
    tap((tabs: IkoTab[]) => this.ikoTabService.setActiveTab(tabs[0]))
  );

  constructor(
    private readonly breadcrumbService: BreadcrumbService,
    private readonly ikoApiService: IkoApiService,
    private readonly ikoTabService: IkoTabService,
    private readonly pageTitleService: PageTitleService,
    private readonly route: ActivatedRoute,
    private readonly translateService: TranslateService
  ) {}

  public ngOnDestroy(): void {
    this.breadcrumbService.clearSecondBreadcrumb();
    this.breadcrumbService.clearThirdBreadcrumb();
    this.pageTitleService.enableReset();
  }

  public onTabSelected(tab: IkoTab): void {
    this.ikoTabService.setActiveTab(tab);
    this._container.clear();
    const componentRef = this._container.createComponent<any>(TabComponentTypes[tab.type] as any);
    componentRef.instance.key = tab.key;
  }
}
