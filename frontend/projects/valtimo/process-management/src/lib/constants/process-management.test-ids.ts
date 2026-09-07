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

export const PROCESS_MANAGEMENT_LIST_TEST_IDS = {
  uploadButton: 'processManagementUploadButton',
  createProcessButton: 'processManagementCreateProcessButton',
} as const;

export const PROCESS_MANAGEMENT_UPLOAD_TEST_IDS = {
  fileUploader: 'processManagementUploadFileUploader',
  cancelButton: 'processManagementUploadCancelButton',
  submitButton: 'processManagementUploadSubmitButton',
  backButton: 'processManagementUploadBackButton',
  importButton: 'processManagementUploadImportButton',
  closeButton: 'processManagementUploadCloseButton',
} as const;

/**
 * The "Process link" group the Valtimo properties provider adds to the bpmn-js
 * properties panel. The surrounding panel is rendered by bpmn-js itself and
 * cannot carry test ids — only this group is ours.
 */
export const PROCESS_LINK_PANEL_TEST_IDS = {
  createButton: 'processLinkPanelCreateButton',
  editButton: 'processLinkPanelEditButton',
  unlinkButton: 'processLinkPanelUnlinkButton',
} as const;

export const PROCESS_MANAGEMENT_BUILDER_TEST_IDS = {
  draftToggle: 'processManagementBuilderDraftToggle',
  startsCaseToggle: 'processManagementBuilderStartsCaseToggle',
  startableByUserToggle: 'processManagementBuilderStartableByUserToggle',
  deployButton: 'processManagementBuilderDeployButton',
  exportOption: 'processManagementBuilderExportOption',
  markersVisibilityToggle: 'processManagementBuilderMarkersVisibilityToggle',
  versionDropdown: 'processManagementBuilderVersionDropdown',
  validateButton: 'processManagementBuilderValidateButton',
  moreButton: 'processManagementBuilderMoreButton',
  readOnlyTag: 'processManagementBuilderReadOnlyTag',
  systemProcessTag: 'processManagementBuilderSystemProcessTag',
  validationErrors: 'processManagementBuilderValidationErrors',
} as const;
