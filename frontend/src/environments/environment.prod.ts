// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.
import {NgxLoggerLevel} from 'ngx-logger';
import {
  CaseListTab,
  IncludeFunction,
  ROLE_ADMIN,
  ROLE_DEVELOPER,
  ROLE_USER,
  TaskListTab,
  UploadProvider,
  ValtimoConfig
} from '@valtimo/shared';
import {authenticationKeycloak} from './auth/keycloak-config';
import {DARK_MODE_LOGO_BASE_64, LOGO_BASE_64} from './logo';

const defaultDefinitionColumns = [
  {
    propertyName: 'sequence',
    translationKey: 'referenceNumber',
    sortable: true
  },
  {
    propertyName: 'createdBy',
    translationKey: 'createdBy',
    sortable: true
  },
  {
    propertyName: 'createdOn',
    translationKey: 'createdOn',
    sortable: true,
    viewType: 'date',
    default: true
  },
  {
    propertyName: 'modifiedOn',
    translationKey: 'lastModified',
    sortable: true,
    viewType: 'date'
  },
  {
    propertyName: 'assigneeFullName',
    translationKey: 'assigneeFullName',
    sortable: true
  }
];

export const environment: ValtimoConfig = {
  logoSvgBase64: LOGO_BASE_64,
  darkModeLogoSvgBase64: DARK_MODE_LOGO_BASE_64,
  production: false,
  authentication: authenticationKeycloak,
  menu: {
    menuItems: [
      {roles: [ROLE_USER], link: ['/'], title: 'Dashboard', iconClass: 'icon mdi mdi-view-dashboard', sequence: 0},
      {roles: [ROLE_USER], title: 'Cases', iconClass: 'icon mdi mdi-layers', sequence: 1, children: []},
      {roles: [ROLE_USER], title: 'Objects', iconClass: 'icon mdi mdi-archive', sequence: 2, includeFunction: IncludeFunction.ObjectManagementEnabled},
      {roles: [ROLE_USER], link: ['/tasks'], title: 'Tasks', iconClass: 'icon mdi mdi-check-all', sequence: 3},
      {roles: [ROLE_USER], link: ['/analysis'], title: 'Analysis', iconClass: 'icon mdi mdi-chart-bar', sequence: 4},
      {
        roles: [ROLE_ADMIN], title: 'Admin', iconClass: 'icon mdi mdi-tune', sequence: 5, children: [
          {title: 'Configuration', textClass: 'text-dark font-weight-bold c-default', sequence: 1},
          {link: ['/case-management'], title: 'Cases', sequence: 2},
          {link: ['/plugins'], title: 'Plugins', sequence: 3},
          {link: ['/dashboard-management'], title: 'Dashboard', sequence: 4},
          {link: ['/access-control'], title: 'Access Control', sequence: 5},
          {link: ['/translation-management'], title: 'Translations', sequence: 6},
          {link: ['/choice-fields'], title: 'Choice fields', sequence: 7},

          {title: 'Object management', textClass: 'text-dark font-weight-bold c-default', sequence: 8},
          {link: ['/object-management'], title: 'Objects', sequence: 9},
          {link: ['/form-management'], title: 'Forms', sequence: 10},
          {
            link: ['/notifications-api/notifications/failed'],
            title: 'Failed notifications',
            sequence: 11,
          },

          {title: 'System processes', textClass: 'text-dark font-weight-bold c-default', sequence: 12},
          {link: ['/processes'], title: 'Processes', sequence: 13},
          {link: ['/decision-tables'], title: 'Decision tables', sequence: 14},

          {title: 'Other', textClass: 'text-dark font-weight-bold c-default', sequence: 15},
          {link: ['/logging'], title: 'Logs', sequence: 16},
          {link: ['/case-migration'], title: 'Case migration (beta)', sequence: 17},
          {link: ['/process-migration'], title: 'Process migration', sequence: 18},
        ],
      },
      {
        roles: [ROLE_DEVELOPER], title: 'Development', iconClass: 'icon mdi mdi-code', sequence: 6, children: [
          {link: ['/swagger'], title: 'Swagger', iconClass: 'icon mdi mdi-dot-circle', sequence: 1}
        ]
      }
    ]
  },
  whitelistedDomains: ['localhost:4200'],
  mockApi: {
    endpointUri: window['env']['mockApiUri'] || '/mock-api/'
  },
  valtimoApi: {
    endpointUri: window['env']['apiUri'] || '/api/'
  },
  swagger: {
    endpointUri: window['env']['swaggerUri'] || '/v3/api-docs'
  },
  logger: {
    level: NgxLoggerLevel.TRACE
  },
  definitions: { cases: [] },
  openZaak: {
    catalogus: window['env']['openZaakCatalogusId'] || '8225508a-6840-413e-acc9-6422af120db1'
  },
  uploadProvider: UploadProvider.DOCUMENTEN_API,
  defaultDefinitionTable: defaultDefinitionColumns,
  visibleTaskListTabs: [TaskListTab.MINE, TaskListTab.OPEN, TaskListTab.ALL],
  visibleCaseListTabs: [CaseListTab.ALL, CaseListTab.MINE, CaseListTab.OPEN],
  featureToggles: {
    allowUserThemeSwitching: true,
    disableCaseCount: false,
    enableCompactModeToggle: true,
    enableFormFlowBreadcrumbs: true,
    enableIntermediateSave: true,
    enableTabManagement: true,
    enableUserNameInTopBarToggle: true,
    experimentalDmnEditing: true,
    largeLogoMargin: true,
    returnToLastUrlAfterTokenExpiration: true,
    showPlantATreeButton: false,
    showUserNameInTopBar: true,
    sortFilesByDate: true
  }
};
