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
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import {ActivatedRoute, NavigationEnd, Router} from '@angular/router';
import {PageTitleService} from '@valtimo/components';
import {CaseManagementTabConfig, ConfigService} from '@valtimo/config';
import {Tab} from 'carbon-components-angular';
import {combineLatest, filter, map, Observable, startWith, Subscription, tap} from 'rxjs';
import {TabEnum} from '../../models';
import {CaseDetailService, TabService} from '../../services';
import {CaseManagementDocumentDefinitionComponent} from '../case-management-document-definition/case-management-document-definition.component';

@Component({
  templateUrl: './case-management-detail-container.component.html',
  styleUrls: ['./case-management-detail-container.component.scss'],
  providers: [CaseDetailService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseManagementDetailContainerComponent implements OnInit, OnDestroy {
  @ViewChild(CaseManagementDocumentDefinitionComponent)
  private _documentDefinitionTab: CaseManagementDocumentDefinitionComponent;
  @ViewChildren(Tab) private _tabs: QueryList<Tab>;

  private _params: {caseDefinitionKey: string; caseDefinitionVersionTag: string};
  public readonly caseDefinitionKey$: Observable<{
    caseDefinitionKey: string;
    caseDefinitionVersionTag: string;
  }> = this.route.params.pipe(
    tap(
      params =>
        (this._params = params as {caseDefinitionKey: string; caseDefinitionVersionTag: string})
    ),
    map(params => params.caseDefinitionKey || ''),
    filter(caseDefinitionKey => !!caseDefinitionKey)
  );

  public caseListColumn!: boolean;
  public tabManagementEnabled!: boolean;

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

  private _activeVersion: number | null;
  private _subscriptions = new Subscription();

  constructor(
    private readonly caseDetailService: CaseDetailService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly configService: ConfigService,
    private readonly tabService: TabService,
    private readonly pageTitleService: PageTitleService
  ) {
    const featureToggles = this.configService.config.featureToggles;
    this.caseListColumn = featureToggles?.caseListColumn ?? true;
    this.tabManagementEnabled = featureToggles?.enableTabManagement ?? true;
  }

  public ngOnInit(): void {
    this.openActiveVersionSubscription();
    this.pageTitleService.disableReset();
  }

  public ngOnDestroy(): void {
    this.tabService.currentTab = TabEnum.GENERAL;
    this._subscriptions.unsubscribe();
    this.pageTitleService.enableReset();
  }

  public navigateToTab(tab: TabEnum | string): void {
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
      this.caseDetailService.setPreviousSelectedVersionNumber(this._activeVersion);
      this._activeVersion = null;
      return;
    }

    if (!this.pendingTab) {
      return;
    }
    this.tabService.currentTab = this.pendingTab;
  }

  public onVersionSet(version: number): void {
    this.caseDetailService.setSelectedVersionNumber(version);
  }

  private openActiveVersionSubscription(): void {
    this._subscriptions.add(
      this.caseDetailService.selectedVersionNumber$.subscribe((versionNumber: number | null) => {
        this._activeVersion = versionNumber;
      })
    );
  }

  protected onCanDeactivate(): void {
    this._documentDefinitionTab?.onCanDeactivate();
  }
}
