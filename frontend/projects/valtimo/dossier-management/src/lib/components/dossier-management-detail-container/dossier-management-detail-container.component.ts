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
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {PageTitleService, PendingChangesComponent} from '@valtimo/components';
import {CaseManagementTabConfig, ConfigService} from '@valtimo/config';
import {
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  Observable,
  Subscription,
  tap,
} from 'rxjs';
import {TabEnum} from '../../models';
import {DossierDetailService, TabService} from '../../services';
import {DossierManagementDocumentDefinitionComponent} from '../dossier-management-document-definition/dossier-management-document-definition.component';

@Component({
  selector: 'valtimo-dossier-management-detail-container',
  templateUrl: './dossier-management-detail-container.component.html',
  styleUrls: ['./dossier-management-detail-container.component.scss'],
  providers: [DossierDetailService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DossierManagementDetailContainerComponent
  extends PendingChangesComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  @ViewChild('contentContainer', {read: ViewContainerRef})
  private _contentContainer: ViewContainerRef;
  @ViewChild(DossierManagementDocumentDefinitionComponent)
  private _documentDefinitionTab: DossierManagementDocumentDefinitionComponent;

  public readonly documentDefinitionName$: Observable<string> = this.route.params.pipe(
    map(params => params.name || ''),
    filter(docDefName => !!docDefName)
  );

  public caseListColumn!: boolean;
  public tabManagementEnabled!: boolean;

  public _activeTab: TabEnum;
  public pendingTab: TabEnum | null;
  public currentTab$ = this.tabService.currentTab$.pipe(
    tap((currentTab: TabEnum) => {
      this._activeTab = currentTab;
    })
  );
  public readonly injectedCaseManagementTabs$: Observable<CaseManagementTabConfig[]> =
    this.tabService.injectedCaseManagementTabs$;
  public readonly documentDefinitionTitle$ = this.pageTitleService.customPageTitle$;
  public readonly CARBON_THEME = 'g10';
  public readonly DossierManagementTabs = Object.values(TabEnum);

  public readonly TabEnum = TabEnum;

  private _activeVersion: number | null;
  private _pendingVersion: number | null;
  private _subscriptions = new Subscription();
  constructor(
    private readonly dossierDetailService: DossierDetailService,
    private readonly route: ActivatedRoute,
    private readonly configService: ConfigService,
    private readonly tabService: TabService,
    private readonly pageTitleService: PageTitleService
  ) {
    super();
    const featureToggles = this.configService.config.featureToggles;
    this.caseListColumn = featureToggles?.caseListColumn ?? true;
    this.tabManagementEnabled = featureToggles?.enableTabManagement ?? true;
  }

  public ngOnInit(): void {
    this.openActiveVersionSubscription();
  }

  public ngAfterViewInit(): void {
    if (this._documentDefinitionTab) this.customModal = this._documentDefinitionTab.cancelModal;
    this.openInjectedTabSubscription();
  }

  public ngOnDestroy(): void {
    this.tabService.currentTab = TabEnum.DOCUMENT;
    this._subscriptions.unsubscribe();
    this.pageTitleService.enableReset();
  }

  public displayBodyComponent(tab: TabEnum | string, isInjectedTab = false): void {
    if (!this.customModal && !!this._documentDefinitionTab)
      this.customModal = this._documentDefinitionTab.cancelModal;

    if (this.pendingChanges) {
      this.onCanDeactivate();
    }
    this.tabService.currentTab = tab;
  }

  public onCancelRedirectEvent(): void {
    this.onCustomCancel();
    if (this._activeVersion) {
      this.dossierDetailService.setPreviousSelectedVersionNumber(this._activeVersion);
      this._activeVersion = null;
      return;
    }

    if (!this.pendingTab) {
      return;
    }
    this.tabService.currentTab = this.pendingTab;
  }

  public onConfirmRedirectEvent(): void {
    this.pendingTab = null;
    this._activeVersion = null;
    if (this._pendingVersion) {
      this.dossierDetailService.setSelectedVersionNumber(this._pendingVersion);
      this._pendingVersion = null;
      this.dossierDetailService.setPreviousSelectedVersionNumber(null);
    }
    this.onCustomConfirm();
  }

  public onPendingChangesUpdate(pendingChanges: boolean): void {
    this.pendingChanges = pendingChanges;
    this.pendingTab = pendingChanges ? this._activeTab : null;
  }

  public onVersionSet(version: number): void {
    if (this.pendingChanges) {
      this.onCanDeactivate();
      this._pendingVersion = version;
      return;
    }
    this.dossierDetailService.setSelectedVersionNumber(version);
  }

  private openActiveVersionSubscription(): void {
    this._subscriptions.add(
      this.dossierDetailService.selectedVersionNumber$.subscribe((versionNumber: number | null) => {
        this._activeVersion = versionNumber;
      })
    );
  }

  private openInjectedTabSubscription(): void {
    this._subscriptions.add(
      combineLatest([
        this.currentTab$.pipe(distinctUntilChanged()),
        this.injectedCaseManagementTabs$,
      ]).subscribe(([currentTab, injectedCaseManagementTabs]) => {
        const findInjectedTab = injectedCaseManagementTabs.find(
          injectedTab => injectedTab.translationKey === currentTab
        );

        this._contentContainer.clear();
        if (findInjectedTab && this._contentContainer) {
          this._contentContainer.createComponent(findInjectedTab.component);
        }
      })
    );
  }

  protected onCanDeactivate(): void {
    this._documentDefinitionTab?.onCanDeactivate();
  }
}
