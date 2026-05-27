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
        sequence: 0,
      },
      {
        roles: [ROLE_USER],
        title: 'Cases',
        iconClass: 'icon mdi mdi-layers',
        sequence: 1,
        children: [],
      },
      {
        roles: [ROLE_ADMIN],
        title: 'Objects',
        iconClass: 'icon mdi mdi-archive',
        sequence: 2,
        includeFunction: IncludeFunction.ObjectManagementEnabled,
      },
      {
        roles: [ROLE_USER],
        link: ['/tasks'],
        title: 'Tasks',
        iconClass: 'icon mdi mdi-check-all',
        sequence: 3,
      },
      {
        roles: [ROLE_USER],
        link: ['/analysis'],
        title: 'Analysis',
        iconClass: 'icon mdi mdi-chart-bar',
        sequence: 4,
      },
      {
        roles: [ROLE_USER],
        link: ['/teams'],
        title: 'teams.title',
        iconClass: 'icon mdi mdi-account-group',
        sequence: 5,
      },
      {
        roles: [ROLE_ADMIN],
        title: 'Admin',
        iconClass: 'icon mdi mdi-tune',
        sequence: 6,
        children: [
          {title: 'Configuration', textClass: 'text-dark font-weight-bold c-default', sequence: 1},
          {link: ['/admin-settings'], title: 'adminSettings.title', sequence: 2},
          {
            link: ['/building-block-management'],
            title: 'buildingBlockManagement.title',
            sequence: 3,
          },
          {link: ['/case-management'], title: 'Cases', sequence: 4},
          {link: ['/plugins'], title: 'Plugins', sequence: 5},
          {link: ['/dashboard-management'], title: 'Dashboard', sequence: 6},
          {link: ['/access-control'], title: 'Access Control', sequence: 7},
          {link: ['/translation-management'], title: 'Translations', sequence: 8},
          {link: ['/choice-fields'], title: 'Choice fields', sequence: 9},
          {
            title: 'Object management',
            textClass: 'text-dark font-weight-bold c-default',
            sequence: 10,
          },
          {link: ['/object-management'], title: 'Objects', sequence: 11},
          {link: ['/form-management'], title: 'Forms', sequence: 12},
          {link: ['/notifications-api/notifications/failed'], title: 'Notifications', sequence: 13},
          {
            title: 'System processes',
            textClass: 'text-dark font-weight-bold c-default',
            sequence: 14,
          },
          {link: ['/processes'], title: 'Processes', sequence: 15},
          {link: ['/decision-tables'], title: 'Decision tables', sequence: 16},
          {title: 'Other', textClass: 'text-dark font-weight-bold c-default', sequence: 17},
          {link: ['/logging'], title: 'Logs', sequence: 18},
          {link: ['/case-migration'], title: 'Case migration (beta)', sequence: 19},
          {link: ['/process-migration'], title: 'Process migration', sequence: 20},
          {link: ['/task-management'], title: 'Tasks (legacy)', sequence: 21},
          {
            title: 'Valtimo test tools',
            textClass: 'text-dark font-weight-bold c-default',
            sequence: 22,
          },
          {link: ['/notification-test'], title: 'Send notification', sequence: 23},
        ],
      },
      {
        roles: [ROLE_DEVELOPER, ROLE_ADMIN],
        title: 'Development',
        iconClass: 'icon mdi mdi-xml',
        sequence: 7,
        children: [
          {link: ['/swagger'], title: 'Swagger', iconClass: 'icon mdi mdi-dot-circle', sequence: 1},
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
  uploadProvider: UploadProvider.DOCUMENTEN_API,
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
    experimentalDmnEditing: true,
    largeLogoMargin: false,
    returnToLastUrlAfterTokenExpiration: true,
    showPlantATreeButton: false,
    showUserNameInTopBar: true,
    sortFilesByDate: true,
  },
};
