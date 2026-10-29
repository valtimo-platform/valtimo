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

type PluginRequirementSource = 'EMBEDDED' | 'EXTERNAL';

interface PluginsWithDependencies {
  plugins: {
    pluginDefinitionKey: string;
    dependencies: {
      key: string;
    }[];
    source?: PluginRequirementSource;
    pluginDefinitionVersion?: string | null;
  }[];
}

/**
 * A single plugin requirement resolved for a building block, keyed by the
 * `pluginConfigurationMappings` entry it maps to. `mappingKey` is the plain `pluginDefinitionKey`
 * for embedded requirements, or the namespaced `external-plugin:<pluginId>@<version>` key (D2) for
 * external requirements — see `BuildingBlockStateService`.
 */
interface RequiredPlugin {
  mappingKey: string;
  pluginDefinitionKey: string;
  pluginDefinitionVersion: string | null;
  source: PluginRequirementSource;
}

export {PluginRequirementSource, PluginsWithDependencies, RequiredPlugin};
