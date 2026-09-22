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

import {PluginDefinitionWithLogo} from '@valtimo/plugin';

type PluginConfigurationSource = 'embedded' | 'external';

interface UnifiedPluginDefinition extends PluginDefinitionWithLogo {
  source: PluginConfigurationSource;
  externalDefinitionId?: string;
  externalName?: string | null;
  externalDescription?: string | null;
  externalLogoUrl?: string | null;
}

interface UnifiedPluginConfigurationRow {
  id?: string;
  title: string;
  pluginName: string;
  definitionKey: string;
  source: PluginConfigurationSource;
  sourceLabel?: string;
  properties?: object;
  pluginDefinition?: {key: string};
  externalDefinitionId?: string;
  /**
   * Set on external rows whose plugin definition is incompatible with the running GZAC version.
   * Drives the "Incompatible" tag and its tooltip ([compatibilityMessage]) in the table.
   */
  incompatible?: boolean;
  compatibilityMessage?: string;
  /**
   * Drives the "Awaiting host" tag: the configuration is real and everything referencing it
   * resolves, but its plugin cannot run until its host serves it.
   */
  awaitingHost?: boolean;
  /**
   * Drives the "Review required" tag: the plugin's package changed after acceptance, so nothing is
   * pushed and no service token is issued until an admin accepts it.
   */
  reviewRequired?: boolean;
  reviewMessage?: string;
  hostName?: string;
}

export {PluginConfigurationSource, UnifiedPluginDefinition, UnifiedPluginConfigurationRow};
