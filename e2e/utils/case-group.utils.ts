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

import {apiDelete, apiGet, apiGetBuffer, apiPost, apiPostMultipart, apiPut} from './api.utils';
import {generateId} from './dataGenerator';

/**
 * API helpers for case definition groups, pinned items and the cases they list.
 * Used by the My cases suites for setup and cleanup.
 */

export const GROUP_MANAGEMENT_ENDPOINT = '/api/management/v1/case-definition-group';
export const GROUP_USER_ENDPOINT = '/api/v1/case-definition-group';
export const PINNED_ITEM_ENDPOINT = '/api/v1/pinned-item';
const DOCUMENT_ENDPOINT = '/api/v1/document';
const NEW_DOCUMENT_AND_START_PROCESS_ENDPOINT =
  '/api/v1/process-document/operation/new-document-and-start-process';

export type PinnedItemType = 'CASE_DEFINITION' | 'CASE_DEFINITION_GROUP';

export interface CaseGroup {
  key: string;
  title: string;
  description?: string | null;
  color?: string | null;
  memberCount: number;
}

export interface PathMapping {
  caseDefinitionKey: string;
  path: string;
}

export interface GroupListColumnRequest {
  key: string;
  title?: string;
  displayType: {type: string; displayTypeParameters: Record<string, unknown>};
  sortable: boolean;
  defaultSort?: 'ASC' | 'DESC' | null;
  exportable: boolean;
  pathMappings?: PathMapping[];
}

export interface GroupSearchFieldRequest {
  key: string;
  title?: string;
  dataType: string;
  fieldType: string;
  matchType?: string;
  dropdownDataProvider?: string;
  pathMappings?: PathMapping[];
}

export interface PinnedItem {
  itemType: PinnedItemType;
  itemKey: string;
  order: number;
  displayName: string | null;
  color: string | null;
}

interface ActiveCaseDefinition {
  caseDefinitionKey: string;
  caseDefinitionVersionTag: string;
  name: string;
}

/** Unique, recognisable group title. The key is derived from it by the backend. */
export function uniqueGroupTitle(prefix = 'E2E group'): string {
  return `${prefix} ${generateId()}`;
}

// ─── Groups ─────────────────────────────────────────────────────────

export async function createGroupViaApi(
  title: string,
  description?: string,
  color?: string
): Promise<CaseGroup> {
  return apiPost<CaseGroup>(GROUP_MANAGEMENT_ENDPOINT, {title, description, color});
}

export async function getGroupsViaApi(): Promise<CaseGroup[]> {
  return apiGet<CaseGroup[]>(GROUP_MANAGEMENT_ENDPOINT);
}

export async function deleteGroupViaApi(groupKey: string): Promise<void> {
  try {
    await apiDelete(`${GROUP_MANAGEMENT_ENDPOINT}/${groupKey}`);
  } catch {
    // Already deleted
  }
}

export async function addMemberViaApi(groupKey: string, caseDefinitionKey: string): Promise<void> {
  await apiPost(`${GROUP_MANAGEMENT_ENDPOINT}/${groupKey}/member`, {caseDefinitionKey});
}

export async function putListColumnsViaApi(
  groupKey: string,
  columns: GroupListColumnRequest[]
): Promise<void> {
  await apiPut(`${GROUP_MANAGEMENT_ENDPOINT}/${groupKey}/list-column`, columns);
}

export async function putSearchFieldsViaApi(
  groupKey: string,
  fields: GroupSearchFieldRequest[]
): Promise<void> {
  await apiPut(`${GROUP_MANAGEMENT_ENDPOINT}/${groupKey}/search-field`, fields);
}

export async function exportGroupViaApi(groupKey: string): Promise<Buffer> {
  return apiGetBuffer(`${GROUP_MANAGEMENT_ENDPOINT}/${groupKey}/export`);
}

export async function importGroupViaApi(zip: Buffer, fileName = 'case-group.zip'): Promise<void> {
  await apiPostMultipart(`${GROUP_MANAGEMENT_ENDPOINT}/import`, {
    file: {name: fileName, mimeType: 'application/zip', buffer: zip},
  });
}

export async function deleteQuickSearchViaApi(groupKey: string, title: string): Promise<void> {
  try {
    await apiDelete(
      `${GROUP_USER_ENDPOINT}/${groupKey}/stored-quick-search/${encodeURIComponent(title)}`
    );
  } catch {
    // Already deleted
  }
}

/** Creates a group with the given members in one go and returns its backend-generated key. */
export async function createGroupWithMembersViaApi(
  title: string,
  memberKeys: string[],
  description?: string
): Promise<CaseGroup> {
  const group = await createGroupViaApi(title, description);
  for (const memberKey of memberKeys) {
    await addMemberViaApi(group.key, memberKey);
  }
  return group;
}

// ─── Columns ────────────────────────────────────────────────────────

export function caseFieldColumn(
  key: string,
  title: string,
  caseField: string,
  memberKeys: string[],
  options: Partial<GroupListColumnRequest> = {}
): GroupListColumnRequest {
  return {
    key,
    title,
    displayType: {type: 'text', displayTypeParameters: {}},
    sortable: true,
    exportable: true,
    pathMappings: memberKeys.map(caseDefinitionKey => ({caseDefinitionKey, path: caseField})),
    ...options,
  };
}

export function documentColumn(
  key: string,
  title: string,
  pathMappings: PathMapping[],
  options: Partial<GroupListColumnRequest> = {}
): GroupListColumnRequest {
  return {
    key,
    title,
    displayType: {type: 'text', displayTypeParameters: {}},
    sortable: false,
    exportable: true,
    pathMappings,
    ...options,
  };
}

// ─── Pinned items ───────────────────────────────────────────────────

export async function getPinnedItemsViaApi(): Promise<PinnedItem[]> {
  return apiGet<PinnedItem[]>(PINNED_ITEM_ENDPOINT);
}

export async function pinViaApi(itemType: PinnedItemType, itemKey: string): Promise<void> {
  await apiPost(PINNED_ITEM_ENDPOINT, {itemType, itemKey});
}

export async function unpinViaApi(itemType: PinnedItemType, itemKey: string): Promise<void> {
  try {
    await apiDelete(`${PINNED_ITEM_ENDPOINT}/${itemType}/${itemKey}`);
  } catch {
    // Unpin is idempotent; ignore transport errors during cleanup
  }
}

/** Unpins everything and returns what was pinned, so it can be restored afterwards. */
export async function clearPinnedItemsViaApi(): Promise<PinnedItem[]> {
  const pinned = await getPinnedItemsViaApi();
  for (const item of pinned) {
    await unpinViaApi(item.itemType, item.itemKey);
  }
  return pinned;
}

export async function restorePinnedItemsViaApi(items: PinnedItem[]): Promise<void> {
  // Newest pin is returned first; re-pin oldest first to keep the original order
  for (const item of [...items].reverse()) {
    try {
      await pinViaApi(item.itemType, item.itemKey);
    } catch {
      // Target may be gone or already pinned
    }
  }
}

// ─── Cases ──────────────────────────────────────────────────────────

async function getActiveCaseDefinition(caseDefinitionKey: string): Promise<ActiveCaseDefinition> {
  const active = await apiGet<ActiveCaseDefinition[]>('/api/v1/case-definition?active=true');
  const match = active.find(definition => definition.caseDefinitionKey === caseDefinitionKey);
  if (!match) throw new Error(`No active version for case definition "${caseDefinitionKey}"`);
  return match;
}

export async function getActiveVersionTag(caseDefinitionKey: string): Promise<string> {
  return (await getActiveCaseDefinition(caseDefinitionKey)).caseDefinitionVersionTag;
}

/** Display name of the active version, as shown in selects and lists. */
export async function getCaseDefinitionName(caseDefinitionKey: string): Promise<string> {
  return (await getActiveCaseDefinition(caseDefinitionKey)).name;
}

/** Creates a case without starting a process: no internal status. */
export async function createDocumentViaApi(
  caseDefinitionKey: string,
  content: Record<string, unknown>
): Promise<string> {
  const caseDefinitionVersionTag = await getActiveVersionTag(caseDefinitionKey);
  const response = await apiPost<{document: {id: string}}>(DOCUMENT_ENDPOINT, {
    definition: caseDefinitionKey,
    caseDefinitionKey,
    caseDefinitionVersionTag,
    content,
  });
  return response.document.id;
}

/** Creates a case and starts its root process, which sets the initial internal status. */
export async function createDocumentWithProcessViaApi(
  caseDefinitionKey: string,
  content: Record<string, unknown>
): Promise<string> {
  const caseDefinitionVersionTag = await getActiveVersionTag(caseDefinitionKey);
  const response = await apiPost<{document: {id: string}}>(
    NEW_DOCUMENT_AND_START_PROCESS_ENDPOINT,
    {
      processDefinitionKey: caseDefinitionKey,
      request: {
        definition: caseDefinitionKey,
        caseDefinitionKey,
        caseDefinitionVersionTag,
        content,
      },
    }
  );
  return response.document.id;
}

export async function deleteDocumentViaApi(documentId: string): Promise<void> {
  try {
    await apiDelete(`${DOCUMENT_ENDPOINT}/${documentId}`);
  } catch {
    // Already deleted
  }
}
