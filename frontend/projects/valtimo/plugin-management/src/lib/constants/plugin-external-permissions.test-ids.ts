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

export const PLUGIN_EXTERNAL_PERMISSIONS_TEST_IDS = {
  /** Suffixed with the capability. */
  capability: 'external-plugin-permission-capability-',
  /** Suffixed with `<method>-<pattern>`. */
  endpoint: 'external-plugin-permission-',
  /** Suffixed with the event type. */
  event: 'external-plugin-permission-event-',
  /** Suffixed with the origin. */
  egress: 'external-plugin-permission-egress-',
  /** Suffixed with the origin. */
  derivedEgress: 'external-plugin-permission-egress-derived-',
  /** Suffixed with the contract name. */
  declaredContract: 'external-plugin-permission-contract-',
  acceptCheckbox: 'external-plugin-permissions-accept',
} as const;
