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

interface Objecttype {
  id: string;
  title: string;
  objecttypenApiPluginConfigurationId: string;
  objecttypeId: string;
  objecttypeVersion: number;
  objectenApiPluginConfigurationId: string;
  showInDataMenu: boolean;
  formDefinitionView?: string;
  formDefinitionEdit?: string;
}

export interface SearchListColumn {
  ownerId?: string;
  title: string;
  key: string;
  path: string;
  displayType: DisplayType;
  sortable: boolean;
  defaultSort: string;
}

export interface SearchColumn {
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

export interface SearchListColumnView {
  title: string;
  key: string;
  path: string;
  displayType: string;
  displayTypeParameters: string;
  sortable: boolean;
  defaultSort: string;
}

export interface DisplayType {
  type: string;
  displayTypeParameters: DisplayTypeParameters;
}

export interface DisplayTypeParameters {
  enum?: {
    [key: string]: string;
  };
  dateFormat?: string;
}

type ObjecttypeKeys = keyof Objecttype;

export {Objecttype, ObjecttypeKeys};
