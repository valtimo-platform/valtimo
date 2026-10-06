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

export const CASE_OVERVIEW_TEST_IDS = {
  search: 'caseOverviewSearch',
  pinInfoNotification: 'caseOverviewPinInfoNotification',
  groupsSection: 'caseOverviewGroupsSection',
  groupsCount: 'caseOverviewGroupsCount',
  groupTile: 'caseOverviewGroupTile',
  groupPinButton: 'caseOverviewGroupPinButton',
  groupOpenLink: 'caseOverviewGroupOpenLink',
  groupsNoResults: 'caseOverviewGroupsNoResults',
  typesSection: 'caseOverviewTypesSection',
  typesCount: 'caseOverviewTypesCount',
  typeRow: 'caseOverviewTypeRow',
  typeLink: 'caseOverviewTypeLink',
  typePinButton: 'caseOverviewTypePinButton',
  typesNoResults: 'caseOverviewTypesNoResults',
} as const;

export const CASE_LIST_TOOLBAR_TEST_IDS = {
  exportButton: 'caseListExportButton',
  startCaseButton: 'caseListStartCaseButton',
} as const;

export const CASE_MENU_TEST_IDS = {
  casesMenu: 'caseMenuCases',
  pinnedItem: 'caseMenuPinnedItem',
  pinPlaceholder: 'caseMenuPinPlaceholder',
} as const;
