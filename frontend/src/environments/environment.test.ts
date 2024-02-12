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
import {authenticationKeycloak} from './auth/keycloak-config.test';
import {openZaakExtensionInitializer} from '@valtimo/open-zaak';
import {
  Language,
  ROLE_ADMIN,
  ROLE_DEVELOPER,
  ROLE_USER,
  UploadProvider,
  ValtimoConfig,
} from '@valtimo/config';
import {LOGO_BASE_64} from './logo';
import {cspHeaderParamsTest} from './csp';

const defaultDefinitionColumns = [
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
];

export const environment: ValtimoConfig = {
  logoSvgBase64: LOGO_BASE_64,
  applicationTitle: 'Valtimo',
  production: false,
  initializers: [openZaakExtensionInitializer],
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
        roles: [ROLE_USER],
        link: ['/tasks'],
        title: 'Tasks',
        iconClass: 'icon mdi mdi-check-all',
        sequence: 2,
      },
      {
        roles: [ROLE_USER],
        link: ['/analysis'],
        title: 'Analysis',
        iconClass: 'icon mdi mdi-chart-bar',
        sequence: 3,
      },
      {
        roles: [ROLE_ADMIN],
        title: 'Admin',
        iconClass: 'icon mdi mdi-tune',
        sequence: 4,
        children: [
          {title: 'Basics', textClass: 'text-dark font-weight-bold c-default', sequence: 1},
          {link: ['/processes'], title: 'Processes', sequence: 2},
          {link: ['/form-management'], title: 'Forms', sequence: 3},
          {link: ['/form-flow-management'], title: 'Form Flows', sequence: 4},
          {link: ['/decision-tables'], title: 'Decision tables', sequence: 5},
          {link: ['/dossier-management'], title: 'Dossiers', sequence: 6},
          {link: ['/form-links'], title: 'Form links', sequence: 7},
          {link: ['/process-links'], title: 'Process links', sequence: 8},
          {link: ['/access-control'], title: 'Access Control', sequence: 9},
          {link: ['/translation-management'], title: 'Translations', sequence: 10},
          {title: 'Other', textClass: 'text-dark font-weight-bold c-default', sequence: 11},
          {link: ['/process-migration'], title: 'Process migration', sequence: 12},
          {link: ['/choice-fields'], title: 'Choice fields', sequence: 13},
        ],
      },
      {
        roles: [ROLE_DEVELOPER],
        title: 'Development',
        iconClass: 'icon mdi mdi-xml',
        sequence: 5,
        children: [
          {link: ['/swagger'], title: 'Swagger', iconClass: 'icon mdi mdi-dot-circle', sequence: 1},
        ],
      },
    ],
  },
  whitelistedDomains: ['localhost:4200'],
  langKey: Language.NL,
  swagger: {
    endpointUri: 'http://localhost:4200/v3/api-docs',
  },
  mockApi: {
    endpointUri: 'http://localhost:4200/mock-api/',
  },
  valtimoApi: {
    endpointUri: 'http://localhost:4200/api/',
  },
  logger: {
    level: NgxLoggerLevel.TRACE,
  },
  openZaak: {
    catalogus: '8225508a-6840-413e-acc9-6422af120db1',
  },
  uploadProvider: UploadProvider.OPEN_ZAAK,
  caseFileSizeUploadLimitMB: 10,
  definitions: {
    dossiers: [],
  },
  defaultDefinitionTable: defaultDefinitionColumns,
  customDefinitionTables: {},
  featureToggles: {
    showUserNameInTopBar: true,
    largeLogoMargin: true,
    enableTabManagement: true,
  },
  csp: cspHeaderParamsTest,
};
