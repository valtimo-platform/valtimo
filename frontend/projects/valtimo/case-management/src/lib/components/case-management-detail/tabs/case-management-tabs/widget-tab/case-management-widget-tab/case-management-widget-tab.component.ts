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
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Edit16} from '@carbon/icons';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {ApiTabItem} from '@valtimo/case';
import {
  BreadcrumbService,
  ConfirmationModalComponent,
  PageHeaderService,
  PageTitleService,
  PendingChangesComponent,
  RenderInPageHeaderDirective,
} from '@valtimo/components';
import {getCaseManagementRouteParams} from '@valtimo/shared';
import {ButtonModule, IconModule, IconService, TabsModule} from 'carbon-components-angular';
import moment from 'moment/moment';
import {BehaviorSubject, combineLatest, filter, map, Observable, switchMap, tap} from 'rxjs';
import {WidgetEditorTab} from '../../../../../../models';
import {
  TabManagementService,
  WidgetJsonEditorService,
  WidgetTabManagementService,
} from '../../../../../../services';
import {CaseManagementWidgetTabEditModalComponent} from '../case-management-widget-tab-edit-modal/case-management-widget-tab-edit-modal.component';
import {CaseManagementWidgetsEditorComponent} from './editor/case-management-widgets-editor.component';
import {CaseManagementWidgetsJsonEditorComponent} from './json-editor/case-management-widgets-json-editor.component';

@Component({
  templateUrl: './case-management-widget-tab.component.html',
  styleUrl: './case-management-widget-tab.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    CaseManagementWidgetsEditorComponent,
    CaseManagementWidgetTabEditModalComponent,
    CaseManagementWidgetsJsonEditorComponent,
    RenderInPageHeaderDirective,
    ButtonModule,
    IconModule,
    TabsModule,
  ],
})
export class CaseManagementWidgetTabComponent
  extends PendingChangesComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  public readonly caseManagementRouteParams$ = getCaseManagementRouteParams(this.route).pipe(
    tap(params => {
      this.tabManagementService.setParams(params);
      this.tabManagementService.loadTabs();
    })
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
  public readonly currentWidgetTab$ = combineLatest([
    this.caseManagementRouteParams$,
    this.tabWidgetKey$,
    this._refreshWidgetTabSubject$,
  ]).pipe(
    switchMap(([params, tabWidgetKey]) =>
      this.widgetTabManagementService.getWidgetTabConfiguration(params, tabWidgetKey)
    )
  );

  public readonly WidgetEditorTab = WidgetEditorTab;
  public readonly activeTab = signal<WidgetEditorTab | null>(WidgetEditorTab.VISUAL);
  public readonly activeContent = signal<WidgetEditorTab | null>(WidgetEditorTab.VISUAL);
  public readonly compactMode$ = this.pageHeaderService.compactMode$;

  private _pendingTab: WidgetEditorTab | null = null;

  constructor(
    private readonly breadcrumbService: BreadcrumbService,
    private readonly iconService: IconService,
    private readonly pageTitleService: PageTitleService,
    private readonly route: ActivatedRoute,
    private readonly tabManagementService: TabManagementService,
    private readonly widgetTabManagementService: WidgetTabManagementService,
    private readonly translateService: TranslateService,
    private readonly pageHeaderService: PageHeaderService,
    private readonly widgetJsonEditorService: WidgetJsonEditorService
  ) {
    super();
  }

  public ngOnInit(): void {
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

  public displayBodyComponent(tab: WidgetEditorTab): void {
    if (this.pendingChanges && tab !== this.activeTab()) {
      this._pendingTab = this.activeTab();
      this.activeTab.set(tab);
      this.onCanDeactivate();
      return;
    }
    this.activeTab.set(tab);
    this.activeContent.set(tab);
  }

  public editWidgetTab(): void {
    this.showEditWidgetTabModal();
  }

  public onPendingChangesUpdate(changeActive: boolean): void {
    this.pendingChanges = changeActive;
  }

  private showEditWidgetTabModal(): void {
    this.showEditWidgetTabModal$.next(true);
  }

  public refreshWidgetTab(): void {
    if (this.pendingChanges) this.onCustomConfirm();
    this._refreshWidgetTabSubject$.next(null);
  }

  public onCustomModalLoaded(modal: ConfirmationModalComponent): void {
    if (!!this.customModal) return;

    this.customModal = modal;
  }

  public onJsonCanDeactivate(canDeactivate: boolean): void {
    if (canDeactivate) {
      this.onCustomConfirm();
      return;
    }

    this.onCustomCancel();
  }

  protected onCancelRedirect(): void {
    this.activeTab.set(this._pendingTab);
  }

  protected onConfirmRedirect(): void {
    this.activeContent.set(this.activeTab());
  }

  protected onCanDeactivate(): void {
    this.widgetJsonEditorService.showPendingModal.set(true);
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
        route: [`${route}/tabs`],
        content: this.translateService.instant('caseManagement.tabs.tabManagement'),
        href: `${route}/tabs`,
      });
    });
  }
}
