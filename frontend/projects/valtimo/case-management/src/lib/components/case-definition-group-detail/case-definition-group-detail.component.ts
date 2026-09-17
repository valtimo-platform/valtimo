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
import {TranslateModule} from '@ngx-translate/core';
import {BreadcrumbService, PageTitleService} from '@valtimo/components';
import {TabsModule} from 'carbon-components-angular';
import {BehaviorSubject, filter, map, Subscription, switchMap} from 'rxjs';
import {CaseDefinitionGroupManagementService} from '../../services';
import {CaseDefinitionGroupWithMembersResponse} from '../../models';

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
  imports: [CommonModule, RouterModule, TranslateModule, TabsModule],
})
export class CaseDefinitionGroupDetailComponent implements OnInit, OnDestroy {
  public readonly GroupTabEnum = GroupTabEnum;

  private readonly _subscriptions = new Subscription();
  private readonly _group$ = new BehaviorSubject<CaseDefinitionGroupWithMembersResponse | null>(
    null
  );
  public readonly group$ = this._group$.asObservable();

  public readonly groupKey$ = this.route.params.pipe(map(params => params['groupKey'] as string));

  public readonly currentTab$ = this.router.events.pipe(
    filter(() => !!this.route.firstChild),
    map(() => this.route.firstChild?.snapshot.url[0]?.path ?? GroupTabEnum.CONFIG)
  );

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly groupService: CaseDefinitionGroupManagementService,
    private readonly pageTitleService: PageTitleService,
    private readonly breadcrumbService: BreadcrumbService
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      this.groupKey$
        .pipe(
          filter(key => !!key),
          switchMap(key => this.groupService.getGroup(key))
        )
        .subscribe(group => {
          this._group$.next(group);
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
    this._subscriptions.unsubscribe();
    this.pageTitleService.enableReset();
    this.breadcrumbService.clearThirdBreadcrumb();
  }

  public navigateToTab(tab: GroupTabEnum): void {
    const groupKey = this.route.snapshot.params['groupKey'];
    this.router.navigateByUrl(`/case-management/group/${groupKey}/${tab}`);
  }
}
