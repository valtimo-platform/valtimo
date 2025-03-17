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
import {Inject, NgModule} from '@angular/core';
import {Route, Router, RouterModule, Routes} from '@angular/router';
import {pendingChangesGuard} from '@valtimo/components';
import {CASE_MANAGEMENT_TAB_TOKEN, CaseManagementTabConfig, ROLE_ADMIN} from '@valtimo/config';
import {AuthGuardService} from '@valtimo/security';
import {CaseManagementProcessesComponent} from './components/case-management-processes/case-management-processes.component';
import {DossierManagementDetailContainerComponent} from './components/dossier-management-detail-container/dossier-management-detail-container.component';
import {DossierManagementDetailComponent} from './components/dossier-management-detail/dossier-management-detail.component';
import {DossierManagementDocumentDefinitionComponent} from './components/dossier-management-document-definition/dossier-management-document-definition.component';
import {DossierManagementListColumnsComponent} from './components/dossier-management-list-columns/dossier-management-list-columns.component';
import {DossierManagementListComponent} from './components/dossier-management-list/dossier-management-list.component';
import {DossierManagementSearchFieldsComponent} from './components/dossier-management-search-fields/dossier-management-search-fields.component';
import {DossierManagementStatusesComponent} from './components/dossier-management-statuses/dossier-management-statuses.component';
import {DossierManagementTabsComponent} from './components/dossier-management-tabs/dossier-management-tabs.component';
import {DossierManagementWidgetTabComponent} from './components/dossier-management-widget-tab/dossier-management-widget-tab.component';
import {TabEnum} from './models';

const routes: Routes = [
  {
    path: 'dossier-management',
    component: DossierManagementListComponent,
    canActivate: [AuthGuardService],
    data: {title: 'Dossiers', roles: [ROLE_ADMIN]},
  },
  {
    path: 'dossier-management/dossier/:name/widget-tab/:key',
    component: DossierManagementWidgetTabComponent,
    canActivate: [AuthGuardService],
    // TODO: Check when widgets are back in place
    // canDeactivate: [pendingChangesGuard],
    data: {
      title: 'Widget tab',
      roles: [ROLE_ADMIN],
      customPageTitle: true,
      customPageSubtitle: true,
    },
  },
  {
    path: 'dossier-management/dossier/:caseDefinitionName/version/:caseVersionTag',
    component: DossierManagementDetailContainerComponent,
    canActivate: [AuthGuardService],
    data: {
      title: 'Dossier details',
      roles: [ROLE_ADMIN],
      id: 'caseManagementDetails',
    },
    children: [
      {
        path: TabEnum.DOCUMENT,
        component: DossierManagementDocumentDefinitionComponent,
      },
      {
        path: TabEnum.CASE,
        component: DossierManagementDetailComponent,
      },
      {
        path: TabEnum.PROCESSES,
        component: CaseManagementProcessesComponent,
        canDeactivate: [pendingChangesGuard],
      },
      {
        path: TabEnum.SEARCH,
        component: DossierManagementSearchFieldsComponent,
      },
      {
        path: TabEnum.LIST,
        component: DossierManagementListColumnsComponent,
      },
      {
        path: TabEnum.TABS,
        component: DossierManagementTabsComponent,
      },
      {
        path: TabEnum.STATUSES,
        component: DossierManagementStatusesComponent,
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
  declarations: [],
})
export class DossierManagementRoutingModule {
  constructor(
    @Inject(CASE_MANAGEMENT_TAB_TOKEN)
    private readonly caseManagementTabConfig: CaseManagementTabConfig[],
    private readonly router: Router
  ) {
    if (!this.caseManagementTabConfig) return;

    const detailsRoute: Route | undefined = this.router.config.find(
      (route: Route) => route.data?.id === 'caseManagementDetails'
    );
    if (!detailsRoute) return;
    detailsRoute.children?.push(
      ...this.caseManagementTabConfig.map((tabConfig: CaseManagementTabConfig) => ({
        path: tabConfig.translationKey,
        component: tabConfig.component,
      }))
    );
  }
}
