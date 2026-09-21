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

/** The object overview at `/objects/{objectManagementId}`. */
export const OBJECT_LIST_TEST_IDS = {
  createButton: 'objectListCreateButton',
  modalCloseButton: 'objectListModalCloseButton',
  modalSaveButton: 'objectListModalSaveButton',
} as const;

/** The object detail page at `/objects/{objectManagementId}/{objectId}`. */
export const OBJECT_DETAIL_TEST_IDS = {
  editButton: 'objectDetailEditButton',
  deleteButton: 'objectDetailDeleteButton',
  summaryForm: 'objectDetailSummaryForm',
  modalCloseButton: 'objectDetailModalCloseButton',
  modalSaveButton: 'objectDetailModalSaveButton',
} as const;
