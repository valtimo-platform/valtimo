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

import {BUILDING_BLOCK_MANAGEMENT_TABS} from '../constants';
import {BuildingBlockFormDefinitionDto, BuildingBlockProcessDefinitionDto} from '@valtimo/shared';

type BuildingBlockManagementTabKey =
  | (typeof BUILDING_BLOCK_MANAGEMENT_TABS)[keyof typeof BUILDING_BLOCK_MANAGEMENT_TABS]
  | string;

interface BuildingBlockProcessDefinitionItem extends BuildingBlockProcessDefinitionDto {
  mainText: string;
}

interface BuildingBlockFormDefinitionItem extends BuildingBlockFormDefinitionDto {
  readOnlyText: string;
}

export {
  BuildingBlockManagementTabKey,
  BuildingBlockProcessDefinitionItem,
  BuildingBlockFormDefinitionItem,
};
