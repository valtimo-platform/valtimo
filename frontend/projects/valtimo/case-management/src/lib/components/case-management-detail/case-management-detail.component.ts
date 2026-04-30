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
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChildren,
} from '@angular/core';
import {ActivatedRoute, NavigationEnd, Router} from '@angular/router';
import {PageTitleService} from '@valtimo/components';
import {DocumentDefinition} from '@valtimo/document';
import {
  CaseManagementParams,
  CaseManagementTabConfig,
  ConfigService,
  ConfigurationIssueService,
  getCaseManagementRouteParams,
} from '@valtimo/shared';
import {SseService} from '@valtimo/sse';
import {Tab} from 'carbon-components-angular';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  map,
  Observable,
  shareReplay,
  startWith,
  Subscription,
  switchMap,
} from 'rxjs';
import {
  CaseDefinitionConfigurationIssue,
  ConfigurationIssueUpdatedSseEvent,
  TabEnum,
} from '../../models';
import {CaseDetailService, CaseManagementService, TabService} from '../../services';
import {CASE_MANAGEMENT_DETAIL_TEST_IDS} from '../../constants';

@Component({
  standalone: false,
  templateUrl: './case-management-detail.component.html',
  styleUrls: ['./case-management-detail.component.scss'],
  providers: [CaseDetailService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseManagementDetailComponent implements OnInit, OnDestroy {
  protected readonly testIds = CASE_MANAGEMENT_DETAIL_TEST_IDS;

  @ViewChildren(Tab) private _tabs: QueryList<Tab>;

  private _params: CaseManagementParams | undefined;

  public readonly params$: Observable<CaseManagementParams | undefined> =
    getCaseManagementRouteParams(this.route);

  public readonly caseDefinitionKey$ = this.params$.pipe(
    map(params => params?.caseDefinitionKey ?? '')
  );

  public readonly caseListColumn$ = this.configService.featureToggles$.pipe(
    map(t => t?.caseListColumn ?? true)
  );
  public readonly tabManagementEnabled$ = this.configService.featureToggles$.pipe(
    map(t => t?.enableTabManagement ?? true)
  );

  public _activeTab: TabEnum | string;
  public pendingTab: TabEnum | null | string;

  public readonly currentTab$ = this.router.events.pipe(
    filter(event => event instanceof NavigationEnd),
    map(event => {
      const urlWithoutQuery = (event as NavigationEnd).urlAfterRedirects.split('?')[0];
      const splitUrl = urlWithoutQuery.split('/');
      return splitUrl[splitUrl.length - 1];
    }),
    startWith(this.route.firstChild?.routeConfig?.path)
  );

  public readonly injectedCaseManagementTabs$: Observable<CaseManagementTabConfig[]> =
    this.tabService.injectedCaseManagementTabs$;

  public readonly documentDefinitionTitle$ = this.pageTitleService.customPageTitle$;

  public readonly TabEnum = TabEnum;

  private _activeVersion: string | null;
  private _subscriptions = new Subscription();
  private readonly _refreshConfigurationIssues$ = new BehaviorSubject<null>(null);

  public readonly configurationIssues$: Observable<CaseDefinitionConfigurationIssue[]> =
    combineLatest([
      this.caseDetailService.selectedCaseDefinitionKey$,
      this.caseDetailService.selectedCaseDefinitionVersionTag$,
      this._refreshConfigurationIssues$,
    ]).pipe(
      switchMap(([key, version]) =>
        this.caseManagementService.getConfigurationIssues(key, version)
      ),
      map(issues => issues.filter(issue => !issue.resolved)),
      shareReplay(1)
    );

  constructor(
    private readonly route: ActivatedRoute,
    private readonly caseDetailService: CaseDetailService,
    private readonly caseManagementService: CaseManagementService,
    private readonly configService: ConfigService,
    private readonly configurationIssueService: ConfigurationIssueService,
    private readonly pageTitleService: PageTitleService,
    private readonly router: Router,
    private readonly sseService: SseService,
    private readonly tabService: TabService
  ) {
  }

  public ngOnInit(): void {
    this._subscriptions.add(
      this.caseDetailService.documentDefinition$.subscribe(
        (documentDefinition: DocumentDefinition | null) => {
          if (!documentDefinition) return;

          this.pageTitleService.setCustomPageTitle(documentDefinition.schema.title);
        }
      )
    );
    this.openActiveVersionSubscription();
    this.openConfigurationIssueSseSubscription();
    this.openConfigurationIssueSubscription();
    this.pageTitleService.disableReset();
    this.openParamsSubscription();
  }

  public ngOnDestroy(): void {
    this.tabService.currentTab = TabEnum.GENERAL;
    this._subscriptions.unsubscribe();
    this.pageTitleService.enableReset();
    this.configurationIssueService.setUnresolvedIssueTypes([]);
  }

  public navigateToTab(tab: TabEnum | string): void {
    if (!this._params) return;

    this.router.navigateByUrl(
      `case-management/case/${this._params.caseDefinitionKey}/version/${this._params.caseDefinitionVersionTag}/${tab}`
    );
  }

  public openTabCheckSubscription(): void {
    this._subscriptions.add(
      combineLatest([this._tabs.changes, this.currentTab$]).subscribe(([tabs, currentTab]) => {
        tabs.forEach((tab: Tab) => (tab.active = tab.id === currentTab));
      })
    );
  }

  public onCancelRedirectEvent(): void {
    if (this._activeVersion) {
      this.caseDetailService.setPreviousSelectedCaseDefinitionVersionTag(`${this._activeVersion}`);
      this._activeVersion = null;
      return;
    }

    if (!this.pendingTab) {
      return;
    }
    this.tabService.currentTab = this.pendingTab;
  }

  public onVersionSet(version: number): void {
    this.caseDetailService.setSelectedCaseDefinitionVersionTag(`${version}`);
  }

  private openActiveVersionSubscription(): void {
    this._subscriptions.add(
      this.caseDetailService.selectedCaseDefinitionVersionTag$.subscribe(
        (versionTag: string | null) => {
          this._activeVersion = versionTag;
        }
      )
    );
  }

  private openConfigurationIssueSubscription(): void {
    this._subscriptions.add(
      this.configurationIssues$.subscribe(issues =>
        this.configurationIssueService.setUnresolvedIssueTypes(issues.map(issue => issue.issueType))
      )
    );
  }

  private openConfigurationIssueSseSubscription(): void {
    this._subscriptions.add(
      combineLatest([
        this.caseDetailService.selectedCaseDefinitionKey$,
        this.sseService.getSseEventObservable<ConfigurationIssueUpdatedSseEvent>(
          'CONFIGURATION_ISSUE_UPDATED'
        ),
      ])
        .pipe(filter(([key, event]) => event.caseDefinitionKey === key))
        .subscribe(() => {
          this._refreshConfigurationIssues$.next(null);
        })
    );
  }

  private openParamsSubscription(): void {
    this._subscriptions.add(
      this.params$.subscribe(params => {
        this.caseDetailService.setSelectedCaseDefinitionKey(params?.caseDefinitionKey ?? '');
        this.caseDetailService.setSelectedCaseDefinitionVersionTag(
          params?.caseDefinitionVersionTag ?? ''
        );
        this._params = params;
      })
    );
  }

  protected onCanDeactivate(): void {
    //TODO: Fix pending changes with new routing
    // this._documentDefinitionTab?.onCanDeactivate();
  }
}
