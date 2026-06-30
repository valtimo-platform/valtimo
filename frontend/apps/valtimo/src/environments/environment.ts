// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.
import {NgxLoggerLevel} from 'ngx-logger';
import {ROLE_ADMIN, ROLE_DEVELOPER, ROLE_USER, ValtimoConfig, UploadProvider, IncludeFunction} from '@valtimo/shared';
import {authenticationKeycloak} from './auth/keycloak-config';
import {defaultDefinitionColumns} from './columns';
import {DARK_MODE_LOGO_BASE_64, LOGO_BASE_64} from './logo';

export const environment: ValtimoConfig = {
  logoSvgBase64: LOGO_BASE_64,
  darkModeLogoSvgBase64: DARK_MODE_LOGO_BASE_64,
  production: false,
  authentication: authenticationKeycloak,
  menu: {
    menuItems: [
      {roles: [ROLE_USER], link: ['/'], title: 'Dashboard', iconClass: 'icon mdi mdi-view-dashboard', sequence: 0},
      {roles: [ROLE_USER], title: 'Cases', iconClass: 'icon mdi mdi-layers', sequence: 1, children: []},
      {roles: [ROLE_USER], link: ['/tasks'], title: 'Tasks', iconClass: 'icon mdi mdi-check-all', sequence: 2},
      {roles: [ROLE_USER], title: 'Objects', iconClass: 'icon mdi mdi-archive', sequence: 3, includeFunction: IncludeFunction.ObjectManagementEnabled},
      {roles: [ROLE_USER], link: ['/analysis'], title: 'Analysis', iconClass: 'icon mdi mdi-chart-bar', sequence: 4},
      {roles: [ROLE_USER], link: ['/teams'], title: 'teams.title', iconClass: 'icon mdi mdi-account-group', sequence: 5},
      {
        roles: [ROLE_ADMIN], title: 'Admin', iconClass: 'icon mdi mdi-tune', sequence: 6, children: [
          {title: 'Configuration', textClass: 'text-dark font-weight-bold c-default', sequence: 1},
          {link: ['/admin-settings'], title: 'adminSettings.title'},
          {link: ['/building-block-management'], title: 'buildingBlockManagement.title', sequence: 2},
          {link: ['/case-management'], title: 'Cases', sequence: 3},
          {link: ['/plugins'], title: 'Plugins', sequence: 4},
          {link: ['/dashboard-management'], title: 'Dashboard', sequence: 5},
          {link: ['/access-control'], title: 'Access Control', sequence: 6},
          {link: ['/translation-management'], title: 'Translations', sequence: 7},
          {link: ['/choice-fields'], title: 'Choice fields', sequence: 8},

          {title: 'Object management', textClass: 'text-dark font-weight-bold c-default', sequence: 9},
          {link: ['/object-management'], title: 'Objects', sequence: 10},
          {link: ['/form-management'], title: 'Forms', sequence: 11},

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
        roles: [ROLE_DEVELOPER], title: 'Development', iconClass: 'icon mdi mdi-code', sequence: 7, children: [
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
    catalogus: window['env']['openZaakCatalogusId'] || ''
  },
  uploadProvider: UploadProvider.S3,
  defaultDefinitionTable: defaultDefinitionColumns,
  caseFileSizeUploadLimitMB: window['env']['caseFileSizeUploadLimitMB'] || 5,
  featureToggles: {
    enableObjectManagement: window['env']['featureToggles']?.['enableObjectManagement'] === 'true',
    showUserNameInTopBar: true,
    disableCaseCount: false,
    experimentalDmnEditing: true,
    largeLogoMargin: true,
    sortFilesByDate: true,
    showPlantATreeButton: true,
    returnToLastUrlAfterTokenExpiration: true,
    enableTabManagement: true,
    allowUserThemeSwitching: true,
    enableCompactModeToggle: true,
    enableUserNameInTopBarToggle: true,
    enableIntermediateSave: true,
    enableFormFlowBreadcrumbs: true,
    enableTaskPanel: true
  }
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
