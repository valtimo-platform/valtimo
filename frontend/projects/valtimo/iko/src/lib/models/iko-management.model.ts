/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

import {Type} from '@angular/core';

interface IkoDataAggregateCreateRequest {
  ikoRepositoryConfigKey: string;
  title: string;
  properties: Record<string, any | null>;
}

interface IkoDataAggregateUpdateRequest {
  ikoRepositoryConfigKey: string;
  title: string;
  properties: Record<string, any | null>;
}

interface IkoDataAggregateListResponse {
  key: string;
  title: string;
}

interface IkoDataAggregateResponse {
  key: string;
  title: string;
  properties: Record<string, any | null>;
}

interface IkoDataRequestCreateRequest {
  title: string;
  properties: Record<string, any | null>;
}

interface IkoDataRequestUpdateRequest {
  key: string;
  ikoDataAggregateKey: string;
  title: string;
  properties: Record<string, any | null>;
}

interface IkoDataRequestListResponse {
  key: string;
  title: string;
  searchFields: {
    key: string;
    title: string;
    path: string;
    dataType: string;
    fieldType: string;
    matchType: string;
    dropdownDataProvider: any | null;
    required: boolean;
  }[];
}

interface IkoDataRequestResponse {
  key: string;
  ikoDataAggregateKey: string;
  title: string;
  properties: Record<string, any | null>;
}

interface IkoRepositoryConfigCreateRequest {
  title: string;
  type: string;
  properties: Record<string, any | null>;
}

interface IkoRepositoryConfigUpdateRequest {
  title: string;
  type: string;
  properties: Record<string, any | null>;
}

interface IkoRepositoryConfigListResponse {
  key: string;
  title: string;
  type: string;
}

interface IkoRepositoryConfigResponse {
  key: string;
  title: string;
  type: string;
  properties: Record<string, any | null>;
}

interface IkoTabCreateRequest {
  title: string;
  type: string;
}

interface IkoTabUpdateRequest {
  key: string;
  title: string;
  type: string;
}

interface TabDto {
  key: string;
  title?: string;
  type: string;
}

interface PropertyField {
  title: string;
  key: string;
  type: string;
  dropdownList?: [string, string][];
}

interface WidgetAction {
  key: string;
  label: string;
  type: string;
  // Add more fields as necessary if known
}

interface WidgetDto {
  key: string;
  title: string;
  width: number;
  highContrast: boolean;
  actions?: WidgetAction[];
  type: string;
}

enum IkoManagementTabType {
  LIST = 'list',
  SEARCH_FIELDS = 'search',
  TABS = 'tabs',
}

interface IkoManagementTab {
  key: IkoManagementTabType;
  title: string;
  component: Type<any>;
}

interface IkoSearchFieldResponse {
  key: string;
  title: string;
  fieldType: string;
  order: number;
  ikoDataAggregateKey: string;
  ikoDataRequestKey: string;
  dropdownList?: [string, string][];
  required?: boolean;
  visible?: boolean;
  [key: string]: any;
}

interface IkoSearchFieldCreateRequest {
  title: string;
  fieldType: string;
  dropdownList?: [string, string][];
  required?: boolean;
  visible?: boolean;
}

interface IkoSearchFieldUpdateRequest {
  key: string;
  title: string;
  fieldType: string;
  dropdownList?: [string, string][];
  required?: boolean;
  visible?: boolean;
}

export {
  IkoDataAggregateCreateRequest,
  IkoDataAggregateUpdateRequest,
  IkoDataAggregateListResponse,
  IkoDataAggregateResponse,
  IkoDataRequestCreateRequest,
  IkoDataRequestUpdateRequest,
  IkoDataRequestListResponse,
  IkoDataRequestResponse,
  IkoRepositoryConfigCreateRequest,
  IkoRepositoryConfigUpdateRequest,
  IkoRepositoryConfigListResponse,
  IkoRepositoryConfigResponse,
  IkoTabCreateRequest,
  IkoTabUpdateRequest,
  TabDto,
  PropertyField,
  WidgetDto,
  WidgetAction,
  IkoManagementTab,
  IkoManagementTabType,
  IkoSearchFieldUpdateRequest,
  IkoSearchFieldCreateRequest,
  IkoSearchFieldResponse,
};
