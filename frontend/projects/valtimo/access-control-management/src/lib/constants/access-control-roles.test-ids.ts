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

const ACCESS_CONTROL_ROLES_TEST_IDS = {
  // Roles overview — toolbar batch actions (only rendered once a row is selected)
  exportButton: 'accessControlRolesExport',
  // Role detail — page-header overflow menu
  moreMenuEditMetadata: 'accessControlRoleEditMetadata',
  moreMenuExport: 'accessControlRoleExport',
  // Role metadata modal (shared by add and edit)
  metadataKeyInput: 'accessControlRoleMetadataKey',
  metadataKeyModeSwitch: 'accessControlRoleMetadataKeyModeSwitch',
  metadataConfirmButton: 'accessControlRoleMetadataConfirm',
  metadataCancelButton: 'accessControlRoleMetadataCancel',
  // Role detail — page header
  saveButton: 'accessControlRoleSave',
  // Export role modal
  exportModalSingleFile: 'accessControlRoleExportSingleFile',
  exportModalSeparateFiles: 'accessControlRoleExportSeparateFiles',
  exportModalConfirmButton: 'accessControlRoleExportConfirm',
} as const;

export {ACCESS_CONTROL_ROLES_TEST_IDS};
