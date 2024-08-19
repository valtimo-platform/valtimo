/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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

import {NgxLoggerLevel} from 'ngx-logger';
import {
  DefinitionColumn,
  DossierListTab,
  IncludeFunction,
  Language,
  ROLE_ADMIN,
  ROLE_DEVELOPER,
  ROLE_USER,
  TaskListTab,
  UploadProvider,
  ValtimoConfig,
} from '@valtimo/config';
import {authenticationKeycloak} from './auth/keycloak-config.dev';
import {
  DARK_MODE_LOGO_BASE_64,
  DARK_MODE_LOGO_BASE_64_PNG,
  LOGO_BASE_64,
  LOGO_BASE_64_PNG,
} from './logo';
import {cspHeaderParamsDev} from './csp';

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
        title: 'Dossiers',
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
        roles: [ROLE_ADMIN],
        title: 'Admin',
        iconClass: 'icon mdi mdi-tune',
        sequence: 5,
        children: [
          {title: 'Basics', textClass: 'text-dark font-weight-bold c-default', sequence: 1},
          {link: ['/processes'], title: 'Processes', sequence: 2},
          {link: ['/form-management'], title: 'Forms', sequence: 3},
          {link: ['/form-flow-management'], title: 'Form Flows', sequence: 4},
          {link: ['/decision-tables'], title: 'Decision tables', sequence: 5},
          {link: ['/dossier-management'], title: 'Dossiers', sequence: 6},
          {link: ['/task-management'], title: 'Tasks', sequence: 7},
          {
            link: ['/object-management'],
            title: 'Objects',
            sequence: 8,
            includeFunction: IncludeFunction.ObjectManagementEnabled,
          },
          {link: ['/plugins'], title: 'Plugins', sequence: 9},
          {link: ['/process-links'], title: 'Process links', sequence: 10},
          {link: ['/dashboard-management'], title: 'Dashboard', sequence: 11},
          {link: ['/access-control'], title: 'Access Control', sequence: 12},
          {link: ['/translation-management'], title: 'Translations', sequence: 13},
          {title: 'Other', textClass: 'text-dark font-weight-bold c-default', sequence: 14},
          {link: ['/case-migration'], title: 'Case migration (beta)', sequence: 15},
          {link: ['/process-migration'], title: 'Process migration', sequence: 16},
          {link: ['/choice-fields'], title: 'Choice fields', sequence: 17},
        ],
      },
      {
        roles: [ROLE_DEVELOPER],
        title: 'Development',
        iconClass: 'icon mdi mdi-xml',
        sequence: 6,
        children: [
          {link: ['/swagger'], title: 'Swagger', iconClass: 'icon mdi mdi-dot-circle', sequence: 1},
        ],
      },
    ],
  },
  whitelistedDomains: ['localhost:4200'],
  langKey: Language.NL,
  mockApi: {
    endpointUri: '/mock-api/',
  },
  valtimoApi: {
    endpointUri: '/api/',
  },
  changePasswordUrl: {
    endpointUri: '/placeholder',
  },
  swagger: {
    endpointUri: '/v3/api-docs',
  },
  logger: {
    level: NgxLoggerLevel.TRACE,
  },
  definitions: {
    dossiers: [],
  },
  openZaak: {
    catalogus: '8225508a-6840-413e-acc9-6422af120db1',
  },
  uploadProvider: UploadProvider.DOCUMENTEN_API,
  caseFileSizeUploadLimitMB: 100,
  supportedDocumentFileTypesToViewInBrowser: ['pdf', 'jpg', 'png', 'svg'],
  defaultDefinitionTable: defaultDefinitionColumns,
  customDefinitionTables: {
    leningen: [
      ...defaultDefinitionColumns,
      {propertyName: '$.voornaam', translationKey: 'firstName', sortable: false},
      {
        propertyName: 'relatedFiles',
        translationKey: 'files',
        sortable: true,
        viewType: 'relatedFiles',
      },
      {
        propertyName: '$.lening-akkoord',
        translationKey: 'accepted',
        sortable: false,
        viewType: 'boolean',
      },
    ],
  },
  caseFileUploadAcceptedFiles:
    'image/png, image/jpeg, text/plain, application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/xml',
  visibleTaskListTabs: [TaskListTab.MINE, TaskListTab.OPEN, TaskListTab.ALL],
  visibleDossierListTabs: [DossierListTab.ALL, DossierListTab.MINE, DossierListTab.OPEN],
  customTaskList: {
    fields: [
      {
        propertyName: 'due',
        translationKey: 'due',
        sortable: true,
      },
      {
        propertyName: 'created',
        translationKey: 'created',
        sortable: true,
      },
      {
        propertyName: 'name',
        translationKey: 'name',
        sortable: true,
      },
      {
        propertyName: 'valtimoAssignee.fullName',
        translationKey: 'valtimoAssignee.fullName',
      },
    ],
    defaultSortedColumn: {
      isSorting: true,
      state: {
        name: 'created',
        direction: 'ASC',
      },
    },
  },
  customLeftSidebar: {
    defaultMenuWidth: 256,
    maxMenuWidth: 550,
    minMenuWidth: 150,
  },
  caseObjectTypes: {
    leningen: ['Boom', 'Straatverlichting'],
  },
  featureToggles: {
    enableHackathonCasesPage: true,
    showUserNameInTopBar: true,
    showPlantATreeButton: true,
    experimentalDmnEditing: true,
    largeLogoMargin: true,
    sortFilesByDate: true,
    disableCaseCount: false,
    returnToLastUrlAfterTokenExpiration: true,
    useStartEventNameAsStartFormTitle: true,
    allowUserThemeSwitching: true,
    enableUserNameInTopBarToggle: true,
    enableTabManagement: true,
    enableObjectManagement: true,
    enableFormViewModel: true,
    enableIntermediateSave: true,
    enableTaskPanel: false,
  },
  customDossierHeader: {
    leningen: [
      {
        propertyPaths: ['voornaam'],
        columnSize: 3,
        textSize: 'sm',
      },
    ],
  },
  csp: cspHeaderParamsDev,
  formioOptions: {
    languageOverride: {
      'en-US': {
        decimalSeparator: ':',
        delimiter: ':',
      },
    },
  },
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
