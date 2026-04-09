/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

import {BuildingBlockInputMapping, BuildingBlockOutputMapping} from '@valtimo/process-link';

export enum StartableItemType {
  PROCESS = 'PROCESS',
  BUILDING_BLOCK = 'BUILDING_BLOCK',
}

export interface ManagementStartableItem {
  type: StartableItemType;
  name: string | null;
  key: string;
  versionTag: string | null;
  processDefinitionId: string | null;
  sortOrder: number | null;
}

export interface StartableItemOrderEntry {
  key: string;
  type: StartableItemType;
  sortOrder: number;
}

export interface UpdateStartableItemOrderRequest {
  items: StartableItemOrderEntry[];
}

export interface CreateStartableItemRequest {
  type: StartableItemType;
  properties: CreateStartableItemProcessProperties | CreateStartableItemBuildingBlockProperties;
}

export interface CreateStartableItemProcessProperties {
  processDefinitionId: string;
}

export interface CreateStartableItemBuildingBlockProperties {
  buildingBlockDefinitionKey: string;
  buildingBlockDefinitionVersionTag: string;
}

export interface BuildingBlockItemProperties {
  inputMappings: Array<BuildingBlockInputMapping>;
  outputMappings: Array<BuildingBlockOutputMapping>;
  pluginConfigurationMappings: Record<string, string>;
}
