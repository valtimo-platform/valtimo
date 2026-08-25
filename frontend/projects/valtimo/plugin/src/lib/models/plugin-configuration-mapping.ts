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

import {ListItem} from 'carbon-components-angular';

type PluginMappingStatus = 'available' | 'no-configurations' | 'not-installed';

interface PluginConfigurationPreview {
  pluginConfigurationId: string;
  pluginDefinitionKey: string | null;
  existsInTargetEnvironment: boolean;
}

interface PluginMappingRow {
  pluginDefinitionKey: string | null;
  pluginDefinitionTitle: string;
  sourcePluginConfigurationId: string;
  existsInTargetEnvironment: boolean;
  listItems: ListItem[];
  status: PluginMappingStatus;
}

export {PluginConfigurationPreview, PluginMappingRow, PluginMappingStatus};
