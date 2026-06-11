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

import {CommonModule, NgComponentOutlet} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Inject,
  OnDestroy,
  OnInit,
  Optional,
  signal,
  Type,
} from '@angular/core';
import {ActivatedRoute, ParamMap, Router} from '@angular/router';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {PermissionService} from '@valtimo/access-control';
import {BreadcrumbService, PageTitleService} from '@valtimo/components';
import {DocumentService} from '@valtimo/document';
import {forkJoin, Subscription, switchMap, take} from 'rxjs';
import {TabsModule} from 'carbon-components-angular';
import {
  CAN_INSPECT_CASE_PERMISSION,
  CASE_DETAIL_PERMISSION_RESOURCE,
} from '../permissions/case-detail.permissions';
import {CaseInspectionBuildingBlocksTabComponent} from './tabs/building-blocks/building-blocks-tab.component';
import {CaseInspectionDocumentTabComponent} from './tabs/document/document-tab.component';
import {CaseInspectionLogsTabComponent} from './tabs/logs/logs-tab.component';
import {CaseInspectionMetadataTabComponent} from './tabs/metadata/metadata-tab.component';
import {CaseInspectionProcessesTabComponent} from './tabs/processes/processes-tab.component';
import {
  BuildingBlockProcessReference,
  CaseInspectionTab,
  ZgwCaseInspectionTabComponent,
} from '../models';
import {ZGW_CASE_INSPECTION_TAB_TOKEN} from '../constants';

@Component({
  standalone: true,
  templateUrl: './case-inspection.component.html',
  styleUrls: ['./case-inspection.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    NgComponentOutlet,
    TranslateModule,
    TabsModule,
    CaseInspectionDocumentTabComponent,
    CaseInspectionProcessesTabComponent,
    CaseInspectionBuildingBlocksTabComponent,
    CaseInspectionLogsTabComponent,
    CaseInspectionMetadataTabComponent,
  ],
})
export class CaseInspectionComponent implements OnInit, OnDestroy {
  public readonly $documentId = signal<string>('');
  public readonly $caseDefinitionKey = signal<string>('');
  public readonly $activeTab = signal<CaseInspectionTab>(CaseInspectionTab.DOCUMENT);
  public readonly $loading = signal<boolean>(true);
  public readonly $accessDenied = signal<boolean>(false);
  public readonly $pendingBuildingBlockInstanceId = signal<string | null>(null);
  public readonly $pendingProcessInstanceLogFilter = signal<string | null>(null);

  public readonly CaseInspectionTab = CaseInspectionTab;

  private readonly _subscriptions = new Subscription();

  private get _validTabs(): readonly CaseInspectionTab[] {
    return this.zgwTabComponent
      ? Object.values(CaseInspectionTab)
      : Object.values(CaseInspectionTab).filter(tab => tab !== CaseInspectionTab.ZGW);
  }

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly permissionService: PermissionService,
    private readonly pageTitleService: PageTitleService,
    private readonly translateService: TranslateService,
    private readonly breadcrumbService: BreadcrumbService,
    private readonly documentService: DocumentService,
    @Optional()
    @Inject(ZGW_CASE_INSPECTION_TAB_TOKEN)
    public readonly zgwTabComponent: Type<ZgwCaseInspectionTabComponent> | null
  ) {}

  public ngOnInit(): void {
    this.pageTitleService.disableReset();

    this._subscriptions.add(
      this.translateService
        .stream('case.inspection.pageTitle')
        .subscribe(title => this.pageTitleService.setCustomPageTitle(title, true))
    );

    this.restoreTabFromQueryParam();

    this._subscriptions.add(
      this.route.paramMap
        .pipe(
          take(1),
          switchMap((params: ParamMap) => {
            const documentId = params.get('documentId') ?? '';
            const caseDefinitionKey = params.get('caseDefinitionKey') ?? '';
            this.$documentId.set(documentId);
            this.$caseDefinitionKey.set(caseDefinitionKey);

            return forkJoin({
              allowed: this.permissionService.requestPermission(CAN_INSPECT_CASE_PERMISSION, {
                resource: CASE_DETAIL_PERMISSION_RESOURCE.jsonSchemaDocument,
                identifier: documentId,
              }),
              definition: this.documentService.getDocumentDefinition(caseDefinitionKey),
            });
          })
        )
        .subscribe({
          next: ({allowed, definition}) => {
            if (!allowed) {
              this.$accessDenied.set(true);
              this.$loading.set(false);
              this.router.navigate(['/cases']);
              return;
            }
            this.$loading.set(false);
            this.initBreadcrumbs(definition.schema.title);
          },
          error: () => {
            this.$accessDenied.set(true);
            this.$loading.set(false);
            this.router.navigate(['/cases']);
          },
        })
    );
  }

  public ngOnDestroy(): void {
    this.pageTitleService.enableReset();
    this.breadcrumbService.clearSecondBreadcrumb();
    this.breadcrumbService.clearThirdBreadcrumb();
    this._subscriptions.unsubscribe();
  }

  public onTabSelected(tab: CaseInspectionTab): void {
    this.$activeTab.set(tab);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {tab},
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  public onViewBuildingBlock(bb: BuildingBlockProcessReference): void {
    this.$pendingBuildingBlockInstanceId.set(bb.instanceId);
    this.onTabSelected(CaseInspectionTab.BUILDING_BLOCKS);
  }

  public onViewProcessLogs(processInstanceId: string): void {
    this.$pendingProcessInstanceLogFilter.set(processInstanceId);
    this.onTabSelected(CaseInspectionTab.LOGS);
  }

  private initBreadcrumbs(caseDefinitionTitle: string): void {
    const documentId = this.$documentId();
    const caseDefinitionKey = this.$caseDefinitionKey();

    this.breadcrumbService.setSecondBreadcrumb({
      route: [`/cases/${caseDefinitionKey}`],
      content: caseDefinitionTitle,
      href: `/cases/${caseDefinitionKey}`,
    });
    this.breadcrumbService.setThirdBreadcrumb({
      route: [`/cases/${caseDefinitionKey}/document/${documentId}`],
      content: this.translateService.instant('Case details'),
      href: `/cases/${caseDefinitionKey}/document/${documentId}`,
    });
  }

  private restoreTabFromQueryParam(): void {
    const requested = this.route.snapshot.queryParamMap.get('tab') as CaseInspectionTab | null;
    if (requested && this._validTabs.includes(requested)) {
      this.$activeTab.set(requested);
    }
  }
}
