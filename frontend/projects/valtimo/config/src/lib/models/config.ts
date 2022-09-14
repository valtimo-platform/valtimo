/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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

import {InjectionToken, Injector} from '@angular/core';
import {Auth} from './security.config';
import {MenuConfig} from './menu.config';
import {ITranslationResource} from 'ngx-translate-multi-http-loader';

export const VALTIMO_CONFIG = new InjectionToken<ValtimoConfig>('valtimoConfig');

// eslint-disable-next-line @typescript-eslint/ban-types
export const INITIALIZERS = new InjectionToken<(() => Function)[]>('initializers');
export declare type Direction = 'ASC' | 'DESC';

export interface DefinitionColumn {
  propertyName: string;
  translationKey: string;
  sortable?: boolean;
  viewType?: string;
  default?: boolean | string;
}

export interface CustomDossierHeaderItem {
  labelTranslationKey?: string;
  propertyPaths?: Array<string>;
  columnSize?: number;
  textSize?: string;
  noValueText?: string;
  customClass?: string;
}

export interface CustomTaskList {
  fields: Array<DefinitionColumn>;
  defaultSortedColumn?: SortState;
}

export interface CustomLeftSidebar {
  defaultMenuWidth?: number;
  maxMenuWidth?: number;
  minMenuWidth?: number;
}

export interface Sort {
  name: string;
  direction: Direction;
}

export interface SortState {
  state: Sort;
  isSorting: boolean;
}

export interface ValtimoConfig {
  // eslint-disable-next-line @typescript-eslint/ban-types
  initializers: ((injector: Injector) => Function)[];
  menu: MenuConfig;
  authentication: Auth;
  production: boolean;
  whitelistedDomains: string[];
  valtimoApi: {
    endpointUri: string;
  };
  swagger: {
    endpointUri: string;
  };
  mockApi: {
    endpointUri: string;
  };
  logger: any;
  definitions: any;
  openZaak: {
    catalogus: string;
  };
  uploadProvider: UploadProvider;
  caseFileSizeUploadLimitMB?: number;
  caseFileUploadAcceptedFiles?: string;
  defaultDefinitionTable: Array<DefinitionColumn>;
  customDefinitionTables: {
    [definitionNameId: string]: Array<DefinitionColumn>;
  };
  customDossierHeader?: {
    [definitionNameId: string]: Array<CustomDossierHeaderItem>;
  };
  translationResources?: Array<ITranslationResource>;
  featureToggles?: {
    disableFormFlow?: boolean;
    enableHackathonCasesPage?: boolean;
    showUserNameInTopBar?: boolean;
    experimentalDmnEditing?: boolean;
    enableDocumentenApiDocumentTab?: boolean;
  };
  customTaskList?: CustomTaskList;
  customLeftSidebar?: CustomLeftSidebar;
  caseObjectTypes?: {
    [definitionNameId: string]: Array<string>;
  };
}

export enum UploadProvider {
  S3,
  OPEN_ZAAK,
}
