/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

import {ChangeDetectionStrategy, Component, OnDestroy, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ActivatedRoute, Router, RouterModule} from '@angular/router';
import {Edit16} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';
import {
  BreadcrumbService,
  PageHeaderService,
  PageTitleService,
  RenderInPageHeaderDirective,
} from '@valtimo/components';
import {ButtonModule, IconModule, IconService, TabsModule} from 'carbon-components-angular';
import {BehaviorSubject, filter, map, Subscription} from 'rxjs';
import {CaseDefinitionGroupFormValue, CaseManagementListTab} from '../../models';
import {CaseDefinitionGroupCreateModalComponent} from '../case-definition-group-create-modal/case-definition-group-create-modal.component';
import {CaseDefinitionGroupDetailService} from './case-definition-group-detail.service';
import {
  CASE_DEFINITION_GROUP_DETAIL_TEST_IDS,
  CASE_MANAGEMENT_LIST_TAB_PARAM,
} from '../../constants';

enum GroupTabEnum {
  CONFIG = 'config',
  LIST_COLUMNS = 'list-columns',
  SEARCH_FIELDS = 'search-fields',
}

@Component({
  standalone: true,
  selector: 'valtimo-case-definition-group-detail',
  templateUrl: './case-definition-group-detail.component.html',
  styleUrl: './case-definition-group-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CaseDefinitionGroupDetailService],
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    ButtonModule,
    IconModule,
    TabsModule,
    CaseDefinitionGroupCreateModalComponent,
    RenderInPageHeaderDirective,
  ],
})
export class CaseDefinitionGroupDetailComponent implements OnInit, OnDestroy {
  public readonly GroupTabEnum = GroupTabEnum;

  protected readonly testIds = CASE_DEFINITION_GROUP_DETAIL_TEST_IDS;

  private readonly _subscriptions = new Subscription();
  private readonly _showEditModal$ = new BehaviorSubject<boolean>(false);
  public readonly showEditModal$ = this._showEditModal$.asObservable();

  public readonly group$ = this.detailService.group$;
  public readonly compactMode$ = this.pageHeaderService.compactMode$;

  public readonly groupKey$ = this.route.params.pipe(map(params => params['groupKey'] as string));

  public readonly currentTab$ = this.router.events.pipe(
    filter(() => !!this.route.firstChild),
    map(() => this.route.firstChild?.snapshot.url[0]?.path ?? GroupTabEnum.CONFIG)
  );

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly detailService: CaseDefinitionGroupDetailService,
    private readonly pageTitleService: PageTitleService,
    private readonly breadcrumbService: BreadcrumbService,
    private readonly pageHeaderService: PageHeaderService,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Edit16]);
  }

  public ngOnInit(): void {
    this.breadcrumbService.setSecondBreadcrumb({
      route: ['/case-management'],
      routeExtras: {queryParams: {[CASE_MANAGEMENT_LIST_TAB_PARAM]: CaseManagementListTab.GROUPS}},
      content: 'caseManagement.listTabs.caseGroups',
      href: `/case-management?${CASE_MANAGEMENT_LIST_TAB_PARAM}=${CaseManagementListTab.GROUPS}`,
    });

    this._subscriptions.add(
      this.groupKey$.pipe(filter(key => !!key)).subscribe(key => this.detailService.loadGroup(key))
    );

    this._subscriptions.add(
      this.group$
        .pipe(filter((group): group is NonNullable<typeof group> => !!group))
        .subscribe(group => {
          this.pageTitleService.setCustomPageTitle(group.title, true);
          this.breadcrumbService.setThirdBreadcrumb({
            route: [`/case-management/group/${group.key}`],
            content: group.title,
            href: `/case-management/group/${group.key}`,
          });
        })
    );
  }

  public ngOnDestroy(): void {
    this.breadcrumbService.clearSecondBreadcrumb();
    this._subscriptions.unsubscribe();
    this.pageTitleService.enableReset();
    this.breadcrumbService.clearThirdBreadcrumb();
  }

  public openEditModal(): void {
    this._showEditModal$.next(true);
  }

  public onCloseEditModal(): void {
    this._showEditModal$.next(false);
  }

  public onSaveGroup(value: CaseDefinitionGroupFormValue): void {
    const color = this.detailService.currentGroup?.color;
    this.detailService.updateGroup({...value, color}).subscribe();
  }

  public navigateToTab(tab: GroupTabEnum): void {
    const groupKey = this.route.snapshot.params['groupKey'];
    this.router.navigateByUrl(`/case-management/group/${groupKey}/${tab}`);
  }
}
