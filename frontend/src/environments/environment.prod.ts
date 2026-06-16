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
  CaseListTab,
  DefinitionColumn,
  IncludeFunction,
  Language,
  ROLE_ADMIN,
  ROLE_DEVELOPER,
  ROLE_USER,
  TaskListTab,
  UploadProvider,
  ValtimoConfig,
} from '@valtimo/shared';
import {NgxLoggerLevel} from 'ngx-logger';
import {authenticationKeycloak} from './auth/keycloak-config';
import {cspHeaderParamsDev} from './csp';
import {
  DARK_MODE_LOGO_BASE_64,
  DARK_MODE_LOGO_BASE_64_PNG,
  LOGO_BASE_64,
  LOGO_BASE_64_PNG,
} from './logo';

const defaultDefinitionColumns: Array<DefinitionColumn> = [
  {
    propertyName: 'sequence',
    translationKey: 'referenceNumber',
    sortable: true,
  },
  {
    propertyName: 'createdBy',
    translationKey: 'createdBy',
    sortable: true,
  },
  {
    propertyName: 'createdOn',
    translationKey: 'createdOn',
    sortable: true,
    viewType: 'date',
    default: true,
  },
  {
    propertyName: 'modifiedOn',
    translationKey: 'lastModified',
    sortable: true,
    viewType: 'date',
  },
  {
    propertyName: 'assigneeFullName',
    translationKey: 'assigneeFullName',
    sortable: true,
  },
];

export const environment: ValtimoConfig = {
  logoSvgBase64: LOGO_BASE_64,
  darkModeLogoSvgBase64: DARK_MODE_LOGO_BASE_64,
  logoPngBase64: LOGO_BASE_64_PNG,
  darkModeLogoPngBase64: DARK_MODE_LOGO_BASE_64_PNG,
  applicationTitle: '',
  production: false,
  authentication: authenticationKeycloak,
  menu: {
    menuItems: [
      {
        roles: [ROLE_USER],
        link: ['/'],
        title: 'Dashboard',
        iconClass: 'icon mdi mdi-view-dashboard',
      },
      {
        roles: [ROLE_USER],
        title: 'Cases',
        iconClass: 'icon mdi mdi-layers',
        children: [],
      },
      {
        roles: [ROLE_ADMIN],
        title: 'Objects',
        iconClass: 'icon mdi mdi-archive',
        includeFunction: [IncludeFunction.ObjectManagementEnabled, IncludeFunction.ZgwFeaturesEnabled],
      },
      {
        roles: [ROLE_USER],
        link: ['/tasks'],
        title: 'Tasks',
        iconClass: 'icon mdi mdi-check-all',
      },
      {
        roles: [ROLE_USER],
        link: ['/analysis'],
        title: 'Analysis',
        iconClass: 'icon mdi mdi-chart-bar',
      },
      {
        roles: [ROLE_USER],
        link: ['/teams'],
        title: 'teams.title',
        iconClass: 'icon mdi mdi-account-group',
      },
      {
        roles: [ROLE_ADMIN],
        title: 'Admin',
        iconClass: 'icon mdi mdi-tune',
        children: [
          {title: 'Configuration', textClass: 'text-dark font-weight-bold c-default'},
          {link: ['/admin-settings'], title: 'adminSettings.title'},
          {link: ['/building-block-management'], title: 'buildingBlockManagement.title'},
          {link: ['/case-management'], title: 'Cases'},
          {link: ['/plugins'], title: 'Plugins'},
          {link: ['/dashboard-management'], title: 'Dashboard'},
          {link: ['/access-control'], title: 'Access Control'},
          {link: ['/translation-management'], title: 'Translations'},
          {link: ['/choice-fields'], title: 'Choice fields'},
          {title: 'Object management', textClass: 'text-dark font-weight-bold c-default', includeFunction: IncludeFunction.ZgwFeaturesEnabled},
          {link: ['/object-management'], title: 'Objects', includeFunction: IncludeFunction.ZgwFeaturesEnabled},
          {link: ['/form-management'], title: 'Forms'},
          {link: ['/notifications-api/notifications/failed'], title: 'Notifications', includeFunction: IncludeFunction.ZgwFeaturesEnabled},
          {title: 'System processes', textClass: 'text-dark font-weight-bold c-default'},
          {link: ['/processes'], title: 'Processes'},
          {link: ['/decision-tables'], title: 'Decision tables'},
          {title: 'Other', textClass: 'text-dark font-weight-bold c-default'},
          {link: ['/logging'], title: 'Logs'},
          {link: ['/case-migration'], title: 'Case migration (beta)'},
          {link: ['/process-migration'], title: 'Process migration'},
          {link: ['/task-management'], title: 'Tasks (legacy)'},
          {title: 'Valtimo test tools', textClass: 'text-dark font-weight-bold c-default'},
          {link: ['/notification-test'], title: 'Send notification'},
        ],
      },
      {
        roles: [ROLE_DEVELOPER, ROLE_ADMIN],
        title: 'Development',
        iconClass: 'icon mdi mdi-xml',
        children: [
          {link: ['/swagger'], title: 'Swagger', iconClass: 'icon mdi mdi-dot-circle'},
        ],
      },
    ],
  },
  whitelistedDomains: ['localhost:4200'],
  langKey: Language.NL,
  mockApi: {
    endpointUri: window['env']['mockApiUri'] || '/mock-api/',
  },
  valtimoApi: {
    endpointUri: window['env']['apiUri'] || '/api/',
  },
  swagger: {
    endpointUri: window['env']['swaggerUri'] || '/v3/api-docs',
  },
  logger: {
    level: NgxLoggerLevel.TRACE,
  },
  definitions: {cases: []},
  openZaak: {
    catalogus: window['env']['openZaakCatalogusId'] || '8225508a-6840-413e-acc9-6422af120db1',
  },
  uploadProvider: UploadProvider.S3,
  defaultDefinitionTable: defaultDefinitionColumns,
  visibleTaskListTabs: [TaskListTab.MINE, TaskListTab.TEAM, TaskListTab.OPEN, TaskListTab.ALL],
  visibleCaseListTabs: [CaseListTab.ALL, CaseListTab.MINE, CaseListTab.TEAM, CaseListTab.OPEN],
  featureToggles: {
    allowUserThemeSwitching: true,
    disableCaseCount: false,
    enableCompactModeToggle: true,
    enableFormFlowBreadcrumbs: true,
    enableIntermediateSave: true,
    enableTabManagement: true,
    enableUserNameInTopBarToggle: true,
    enableZgwFeatures: true,
    experimentalDmnEditing: true,
    largeLogoMargin: false,
    returnToLastUrlAfterTokenExpiration: true,
    showPlantATreeButton: false,
    showUserNameInTopBar: true,
    sortFilesByDate: true,
  },
};
