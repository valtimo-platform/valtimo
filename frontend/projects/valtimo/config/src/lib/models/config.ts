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

import {InjectionToken, Injector} from '@angular/core';
import {Auth} from './security.config';
import {MenuConfig} from './menu.config';
import {CSPHeaderParams} from 'csp-header';
import {FormioOptions} from '@formio/angular';

export const VALTIMO_CONFIG = new InjectionToken<ValtimoConfig>('valtimoConfig');

// eslint-disable-next-line
export const INITIALIZERS = new InjectionToken<(() => Function)[]>('initializers');
export declare type Direction = 'ASC' | 'DESC';

export interface DefinitionColumn {
  propertyName: string;
  translationKey: string;
  sortable?: boolean;
  viewType?: string;
  default?: boolean | string;
  enum?: Array<string> | {[key: string]: string};
  title?: string;
  format?: string;
  key?: string;
}

export interface CustomDossierHeaderItem {
  labelTranslationKey?: string;
  propertyPaths?: Array<string>;
  columnSize?: number;
  textSize?: string;
  noValueText?: string;
  customClass?: string;
  modifier?: string;
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

export interface OverrideFormioOptions extends FormioOptions {
  [key: string]: any;
}

export interface ValtimoConfig {
  // eslint-disable-next-line
  logoSvgBase64?: string;
  darkModeLogoSvgBase64?: string;
  logoPngBase64?: string;
  darkModeLogoPngBase64?: string;
  applicationTitle?: string;
  /**@deprecated Initializers will be removed in the future. */
  initializers?: ((injector: Injector) => () => void)[];
  menu: MenuConfig;
  authentication: Auth;
  production: boolean;
  whitelistedDomains: string[];
  langKey?: Language;
  valtimoApi: {
    endpointUri: string;
  };
  changePasswordUrl?: {
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
  supportedDocumentFileTypesToViewInBrowser?: string[];
  defaultDefinitionTable: Array<DefinitionColumn>;
  customDefinitionTables: {
    [definitionNameId: string]: Array<DefinitionColumn>;
  };
  customDossierHeader?: {
    [definitionNameId: string]: Array<CustomDossierHeaderItem>;
  };
  translationResources?: Array<string>;
  featureToggles?: {
    applicationTitleAsSuffix?: boolean;
    enableHackathonCasesPage?: boolean;
    showUserNameInTopBar?: boolean;
    showPlantATreeButton?: boolean;
    experimentalDmnEditing?: boolean;
    disableCaseCount?: boolean;
    caseListColumn?: boolean;
    enableObjectManagement?: boolean;
    largeLogoMargin?: boolean;
    sortFilesByDate?: boolean;
    returnToLastUrlAfterTokenExpiration?: boolean;
    enableTabManagement?: boolean;
    hideValtimoVersionsForNonAdmins?: boolean;
    useStartEventNameAsStartFormTitle?: boolean;
    allowUserThemeSwitching?: boolean;
    enableCompactModeToggle?: boolean;
    compactModeOnByDefault?: boolean;
    enableUserNameInTopBarToggle?: boolean;
  };
  visibleTaskListTabs?: Array<TaskListTab>;
  visibleDossierListTabs?: Array<DossierListTab>;
  customTaskList?: CustomTaskList;
  customLeftSidebar?: CustomLeftSidebar;
  caseObjectTypes?: {
    [definitionNameId: string]: Array<string>;
  };
  overrideFeedbackMenuItemToMailTo?: FeedbackMailTo;
  csp?: CSPHeaderParams;
  formioOptions?: OverrideFormioOptions;
}

export interface FeedbackMailTo {
  email?: string;
  subjectTranslationKey: string;
  bodyTranslationKey: string;
}

export enum UploadProvider {
  S3,
  /**@deprecated This upload provider will be removed in the future. */
  OPEN_ZAAK,
  DOCUMENTEN_API,
}

export enum TaskListTab {
  MINE = 'mine',
  OPEN = 'open',
  ALL = 'all',
}

export enum DossierListTab {
  MINE = 'MINE',
  OPEN = 'OPEN',
  ALL = 'ALL',
}

export enum Language {
  NL = 'nl',
  EN = 'en',
  DE = 'de',
}
