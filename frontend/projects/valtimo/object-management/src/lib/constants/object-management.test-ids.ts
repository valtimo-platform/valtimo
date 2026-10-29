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

/** The object type overview at `/object-management`. */
export const OBJECT_MANAGEMENT_LIST_TEST_IDS = {
  uploadButton: 'objectManagementUploadButton',
  createButton: 'objectManagementCreateButton',
} as const;

/**
 * The add/edit object type modal. The same component serves both, so the save
 * button is labelled "Add object" while adding and "Edit object" while editing.
 */
export const OBJECT_MANAGEMENT_MODAL_TEST_IDS = {
  heading: 'objectManagementModalHeading',
  titleInput: 'objectManagementModalTitleInput',
  objectenApiSelect: 'objectManagementModalObjectenApiSelect',
  objecttypenApiSelect: 'objectManagementModalObjecttypenApiSelect',
  objecttypeIdInput: 'objectManagementModalObjecttypeIdInput',
  objecttypeVersionInput: 'objectManagementModalObjecttypeVersionInput',
  formDefinitionViewSelect: 'objectManagementModalFormDefinitionViewSelect',
  formDefinitionEditSelect: 'objectManagementModalFormDefinitionEditSelect',
  showInDataMenuCheckbox: 'objectManagementModalShowInDataMenuCheckbox',
  suppressOutboxCheckbox: 'objectManagementModalSuppressOutboxCheckbox',
  cancelButton: 'objectManagementModalCancelButton',
  saveButton: 'objectManagementModalSaveButton',
} as const;

/** The object type detail page at `/object-management/object/{id}`. */
export const OBJECT_MANAGEMENT_DETAIL_TEST_IDS = {
  visibleInMenuTag: 'objectManagementVisibleInMenuTag',
  generalTab: 'objectManagementGeneralTab',
  searchFieldsTab: 'objectManagementSearchFieldsTab',
  listTab: 'objectManagementListTab',
  downloadButton: 'objectManagementDownloadButton',
  editButton: 'objectManagementEditButton',
} as const;
