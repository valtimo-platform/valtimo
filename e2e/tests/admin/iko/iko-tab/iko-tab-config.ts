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

/** Shared prefix used for every tab title created by this suite. */
export const IKO_TAB_TITLE_PREFIX = 'E2E IKO Tab';

/**
 * Tab type combo-box items, as exposed by the IkoTabType enum and rendered
 * by the tab-details modal. The current backend only ships the `widgets`
 * type.
 */
export const TAB_TYPE_LABELS = {
  widgets: {label: 'Widgets', id: 'widgets'},
} as const;

/** Column headers shown on the tabs list table. */
export const TAB_HEADERS = ['Key', 'Tab title', 'Tab type', 'Properties'] as const;

/**
 * Backend property field key for the tab property form (`iko` repository
 * type). Used to address the dynamic property test-id.
 */
export const TAB_PROPERTY_KEYS = {
  aggregatedDataProfileName: 'aggregatedDataProfileName',
} as const;

export const ikoTabConfig = {
  titlePrefix: IKO_TAB_TITLE_PREFIX,
  aggregatedDataProfileName: 'personen',
} as const;

/** Build a unique tab title for a single test. */
export function uniqueTabTitle(label: string): string {
  return `${IKO_TAB_TITLE_PREFIX} ${label} ${generateId()}`;
}
