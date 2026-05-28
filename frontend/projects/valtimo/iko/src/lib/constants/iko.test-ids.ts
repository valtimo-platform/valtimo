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

export const IKO_MANAGEMENT_TEST_IDS = {
  configureServerButton: 'ikoConfigureServerButton',
  uploadButton: 'ikoUploadButton',
} as const;

export const IKO_REPOSITORY_MODAL_TEST_IDS = {
  titleInput: 'ikoRepositoryModalTitleInput',
  saveButton: 'ikoRepositoryModalSaveButton',
  cancelButton: 'ikoRepositoryModalCancelButton',
} as const;

export const IKO_PROPERTIES_TEST_IDS = {
  // Dynamic property inputs are suffixed with the property field key,
  // e.g. `ikoPropertyInput-ikoServerUrl`.
  inputPrefix: 'ikoPropertyInput-',
} as const;

export const IKO_UPLOAD_MODAL_TEST_IDS = {
  fileUploader: 'ikoUploadFileUploader',
  overwriteCheckbox: 'ikoUploadOverwriteCheckbox',
  startUploadButton: 'ikoUploadStartButton',
  cancelButton: 'ikoUploadCancelButton',
} as const;
