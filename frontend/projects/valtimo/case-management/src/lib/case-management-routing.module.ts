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
import {Inject, NgModule} from '@angular/core';
import {Route, Router, RouterModule, Routes} from '@angular/router';
import {pendingChangesGuard} from '@valtimo/components';
import {CASE_MANAGEMENT_TAB_TOKEN, CaseManagementTabConfig, ROLE_ADMIN} from '@valtimo/config';
import {AuthGuardService} from '@valtimo/security';
import {CaseManagementProcessesComponent} from './components/case-management-processes/case-management-processes.component';
import {CaseManagementDetailContainerComponent} from './components/case-management-detail-container/case-management-detail-container.component';
import {CaseManagementDetailComponent} from './components/case-management-detail/case-management-detail.component';
import {CaseManagementDocumentDefinitionComponent} from './components/case-management-document-definition/case-management-document-definition.component';
import {CaseManagementListColumnsComponent} from './components/case-management-list-columns/case-management-list-columns.component';
import {CaseManagementListComponent} from './components/case-management-list/case-management-list.component';
import {CaseManagementSearchFieldsComponent} from './components/case-management-search-fields/case-management-search-fields.component';
import {CaseManagementStatusesComponent} from './components/case-management-statuses/case-management-statuses.component';
import {CaseManagementTabsComponent} from './components/case-management-tabs/case-management-tabs.component';
import {CaseManagementWidgetTabComponent} from './components/case-management-widget-tab/case-management-widget-tab.component';
import {TabEnum} from './models';
import {CaseManagementGeneralComponent} from './components/case-management-general/case-management-general.component';
import {
  FormManagementComponent,
  FormManagementEditComponent,
  FormManagementRouteData,
} from '@valtimo/form-management';

const routes: Routes = [
  {
    path: 'case-management',
    component: CaseManagementListComponent,
    canActivate: [AuthGuardService],
    data: {title: 'Cases', roles: [ROLE_ADMIN]},
  },
  {
    path: 'case-management/case/:name/widget-tab/:key',
    component: CaseManagementWidgetTabComponent,
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
    path: 'case-management/case/:caseDefinitionKey/version/:caseDefinitionVersionTag',
    component: CaseManagementDetailContainerComponent,
    canActivate: [AuthGuardService],
    data: {
      title: 'Case details',
      roles: [ROLE_ADMIN],
      id: 'caseManagementDetails',
    },
    children: [
      {
        path: TabEnum.GENERAL,
        component: CaseManagementGeneralComponent,
      },
      {
        path: TabEnum.DOCUMENT,
        component: CaseManagementDocumentDefinitionComponent,
      },
      {
        path: TabEnum.CASE,
        component: CaseManagementDetailComponent,
      },
      {
        path: TabEnum.PROCESSES,
        component: CaseManagementProcessesComponent,
        canDeactivate: [pendingChangesGuard],
      },
      {
        path: TabEnum.SEARCH,
        component: CaseManagementSearchFieldsComponent,
      },
      {
        path: TabEnum.LIST,
        component: CaseManagementListColumnsComponent,
      },
      {
        path: TabEnum.TABS,
        component: CaseManagementTabsComponent,
      },
      {
        path: TabEnum.STATUSES,
        component: CaseManagementStatusesComponent,
      },
      {
        path: TabEnum.FORMS,
        component: FormManagementComponent,
        data: {
          context: 'case',
        } as FormManagementRouteData,
      },
    ],
  },
  {
    path: `case-management/case/:caseDefinitionKey/version/:caseDefinitionVersionTag/${TabEnum.FORMS}/:formDefinitionId`,
    component: FormManagementEditComponent,
    canActivate: [AuthGuardService],
    canDeactivate: [pendingChangesGuard],
    data: {
      title: 'Forms',
      roles: [ROLE_ADMIN],
      context: 'case',
      customPageTitle: true,
    } as FormManagementRouteData,
  },
  {
    path: `case-management/case/:caseDefinitionKey/version/:caseDefinitionVersionTag/${TabEnum.TABS}/widget-tab/:key`,
    component: CaseManagementWidgetTabComponent,
    canActivate: [AuthGuardService],
    canDeactivate: [pendingChangesGuard],
    data: {
      title: 'Widget tab',
      roles: [ROLE_ADMIN],
      customPageTitle: true,
      customPageSubtitle: true,
    },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
  declarations: [],
})
export class CaseManagementRoutingModule {
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
