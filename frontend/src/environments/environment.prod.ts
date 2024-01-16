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
  Language,
  ROLE_ADMIN,
  ROLE_DEVELOPER,
  ROLE_USER,
  UploadProvider,
  ValtimoConfig,
} from '@valtimo/config';
import {authenticationKeycloak} from './auth/keycloak-config.prod';
import {openZaakExtensionInitializer} from '@valtimo/open-zaak';
import {LOGO_BASE_64} from './logo';
import {cspHeaderParamsProd} from './csp';

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
  production: true,
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
          {link: ['/decision-tables'], title: 'Decision tables', sequence: 4},
          {link: ['/dossier-management'], title: 'Dossiers', sequence: 5},
          {link: ['/connectors'], title: 'Connectors', sequence: 6},
          {link: ['/form-links'], title: 'Process links', sequence: 7},
          {link: ['/access-control'], title: 'Access Control', sequence: 8},
          {title: 'Other', textClass: 'text-dark font-weight-bold c-default', sequence: 9},
          {link: ['/process-migration'], title: 'Process migration', sequence: 10},
          {link: ['/choice-fields'], title: 'Choice fields', sequence: 11},
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
  whitelistedDomains: [],
  langKey: Language.NL,
  swagger: {
    endpointUri: '/v3/api-docs',
  },
  mockApi: {
    endpointUri: '/mock-api/',
  },
  valtimoApi: {
    endpointUri: '/api/',
  },
  logger: {
    level: NgxLoggerLevel.ERROR,
  },
  definitions: {
    dossiers: [],
  },
  openZaak: {
    catalogus: '8225508a-6840-413e-acc9-6422af120db1',
  },
  uploadProvider: UploadProvider.OPEN_ZAAK,
  caseFileSizeUploadLimitMB: 10,
  defaultDefinitionTable: defaultDefinitionColumns,
  customDefinitionTables: {},
  featureToggles: {
    showUserNameInTopBar: true,
    largeLogoMargin: true,
    enableTabManagement: true,
  },
  csp: cspHeaderParamsProd,
};
