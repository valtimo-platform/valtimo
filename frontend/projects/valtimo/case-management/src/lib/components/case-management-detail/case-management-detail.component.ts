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
import {combineLatest, filter, map, Observable, startWith, Subscription} from 'rxjs';
import {CaseManagementParams, TabEnum} from '../../models';
import {CaseDetailService, TabService} from '../../services';
import {CaseManagementDocumentDefinitionComponent} from './tabs/case-management-document-definition/case-management-document-definition.component';
import {getCaseManagementRouteParams} from '../../utils';
import {DocumentDefinition} from '@valtimo/document';

@Component({
  standalone: false,
  templateUrl: './case-management-detail.component.html',
  styleUrls: ['./case-management-detail.component.scss'],
  providers: [CaseDetailService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseManagementDetailComponent implements OnInit, OnDestroy {
  @ViewChild(CaseManagementDocumentDefinitionComponent)
  private _documentDefinitionTab: CaseManagementDocumentDefinitionComponent;
  @ViewChildren(Tab) private _tabs: QueryList<Tab>;

  private _params: CaseManagementParams | undefined;

  public readonly params$: Observable<CaseManagementParams | undefined> =
    getCaseManagementRouteParams(this.route);

  public readonly caseDefinitionKey$ = this.params$.pipe(
    map(params => params?.caseDefinitionKey ?? '')
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

  private _activeVersion: string | null;
  private _subscriptions = new Subscription();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly caseDetailService: CaseDetailService,
    private readonly configService: ConfigService,
    private readonly pageTitleService: PageTitleService,
    private readonly router: Router,
    private readonly tabService: TabService
  ) {
    const featureToggles = this.configService.config.featureToggles;
    this.caseListColumn = featureToggles?.caseListColumn ?? true;
    this.tabManagementEnabled = featureToggles?.enableTabManagement ?? true;
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
    this.pageTitleService.disableReset();
    this.openParamsSubscription();
  }

  public ngOnDestroy(): void {
    this.tabService.currentTab = TabEnum.GENERAL;
    this._subscriptions.unsubscribe();
    this.pageTitleService.enableReset();
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
    this._documentDefinitionTab?.onCanDeactivate();
  }
}
