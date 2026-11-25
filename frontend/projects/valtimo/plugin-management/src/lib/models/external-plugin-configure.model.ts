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

import {
  ExternalPluginContractBindingEntry,
  ExternalPluginGrantedEndpointEntry,
  ExternalPluginGrantedEventEntry,
} from '@valtimo/plugin';

/** What the "enter data" step hands its host to activate an external plugin configuration. */
interface ExternalPluginSaveEvent {
  definitionId: string;
  title: string;
  properties: Record<string, unknown>;
  grantedEndpoints: Array<ExternalPluginGrantedEndpointEntry>;
  grantedEvents: Array<ExternalPluginGrantedEventEntry>;
  grantedCapabilities: Array<string>;
  grantedEgress: Array<string>;
  contractBindings: Array<ExternalPluginContractBindingEntry>;
}

export {ExternalPluginSaveEvent};
