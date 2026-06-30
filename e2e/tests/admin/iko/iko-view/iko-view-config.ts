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

import {generateId} from '../../../../utils/dataGenerator';

/** Shared prefix used for every view title created by this suite. */
export const IKO_VIEW_TITLE_PREFIX = 'E2E IKO View';

/**
 * Property field keys exposed by the backend (`IkoServerRepository.kt`) for
 * the `iko` repository view. They are used to build the dynamic test-ids
 * (`ikoPropertyInput-<key>`, `ikoPropertyTooltip-<key>`, ...) and to
 * reference the same fields from the page object.
 */
export const IKO_VIEW_PROPERTY_KEYS = {
  connectorTag: 'connectorTag',
  connectorInstanceTag: 'connectorInstanceTag',
  endpointOperation: 'endpointOperation',
  endpointQueryParameters: 'endpointQueryParameters',
} as const;

/** Tooltip copy as defined in the backend, used for tooltip assertions. */
export const IKO_VIEW_PROPERTY_TOOLTIPS: Record<string, string> = {
  [IKO_VIEW_PROPERTY_KEYS.connectorTag]:
    'The connector-reference or the connector-tag as defined in IKO',
  [IKO_VIEW_PROPERTY_KEYS.connectorInstanceTag]:
    'The connector-instance-reference or the connector-instance tag as defined in IKO',
  [IKO_VIEW_PROPERTY_KEYS.endpointOperation]:
    'The endpoint-reference or the endpoint-operation as defined in IKO',
  [IKO_VIEW_PROPERTY_KEYS.endpointQueryParameters]:
    "Additional query parameters for the IKO API URL. i.e. 'type=ZoekMetGeslachtsnaamEnGeboortedatum'",
};

export const ikoViewConfig = {
  titlePrefix: IKO_VIEW_TITLE_PREFIX,
  connectorTag: 'example-connector',
  connectorInstanceTag: 'example-instance',
  endpointOperation: 'example-endpoint',
  queryParamKey: 'type',
  queryParamValue: 'ZoekMetGeslachtsnaamEnGeboortedatum',
} as const;

/** Build a unique view title for a single test. */
export function uniqueViewTitle(label: string): string {
  return `${IKO_VIEW_TITLE_PREFIX} ${label} ${generateId()}`;
}
