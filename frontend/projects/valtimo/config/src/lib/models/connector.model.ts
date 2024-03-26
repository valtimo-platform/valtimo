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

type ConnectorPropertyEditType = 'string' | 'number' | 'string[]' | 'number[]';
type ConnectorPropertyValueType = string | number | Array<number> | Array<string>;

interface ConnectorProperties {
  className: string;
  [key: string]: ConnectorPropertyValueType | ConnectorProperties;
}

interface ConnectorPropertyEditField {
  key: string;
  editType: ConnectorPropertyEditType;
  defaultValue?: ConnectorPropertyValueType;
}

interface ConnectorInstance {
  id: string;
  name: string;
  type: ConnectorType;
  properties: ConnectorProperties;
}

interface ConnectorInstanceCreateRequest {
  name: string;
  typeId: string;
  connectorProperties: ConnectorProperties;
}

interface ConnectorInstanceUpdateRequest {
  name: string;
  typeId: string;
  id: string;
  connectorProperties: ConnectorProperties;
}

interface ConnectorType {
  className: string;
  id: string;
  name: string;
  properties: ConnectorProperties;
}

type ConnectorModal = 'add' | 'modify';

export {
  ConnectorProperties,
  ConnectorInstance,
  ConnectorType,
  ConnectorModal,
  ConnectorPropertyEditField,
  ConnectorPropertyEditType,
  ConnectorInstanceCreateRequest,
  ConnectorInstanceUpdateRequest,
  ConnectorPropertyValueType,
};
