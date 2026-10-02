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

/**
 * A building block that is part of the seeded content of the dev app. Used for
 * the read-only list assertions and as the source of a key collision when
 * exercising the auto-key generator.
 */
export const SEEDED_BUILDING_BLOCK = {
  key: 'income-check',
  name: 'Inkomenstoets',
  /**
   * Slugifies to `income-check`, i.e. the key of the seeded building block
   * above, so the auto-key input has to de-duplicate it.
   */
  collidingName: 'income check',
  deduplicatedKey: 'income-check-1',
} as const;

/**
 * Archive imported by the upload tests.
 *
 * It deliberately contains only a building block definition and a document
 * definition — no BPMN. Archives that carry a process definition can only be
 * imported once per key: the second import deploys a second process definition
 * for the same key and the backend then fails with "Only one process definition
 * should be found for key ...". Without a BPMN the import is idempotent, so this
 * archive can be re-imported on every run and the environment never gains more
 * than this single building block.
 */
export const IMPORT_ARCHIVE = {
  fileName: 'e2e-building-block-import-success_1.0.0.zip',
  key: 'e2e-bb-import',
  name: 'E2E Imported Building Block',
  versionTag: '1.0.0',
} as const;

/** A ZIP that holds no building block definition at all. */
export const INVALID_IMPORT_ARCHIVE_FILE_NAME = 'e2e-building-block-import-invalid-file.zip';

/** Values used when creating a building block through the create modal. */
export const NEW_BUILDING_BLOCK = {
  namePrefix: 'e2e bb',
  versionTag: '1.0.0',
  description: 'Building block created by the e2e building block management test.',
} as const;

export const BUILDING_BLOCK_TEXTS = {
  listColumns: ['Name', 'Key', 'Version'],
  duplicateKeyError: 'This key is already in use. Please change to a unique key.',
  pluginStepTitle: 'Plugin Configuration',
  fileSelectStepTitle: 'Upload file',
  fileSizeHint: 'Max file size is 500kb. Supported file types are ZIP and JSON.',
  overwriteWarning:
    'If your building block definition contains configurations, models and/or definitions with the same name or identifier as already on your system, they will be overwritten.',
  overwriteCheckbox: 'I understand that configurations may be overwritten',
  uploadSuccess: 'Building block definition successfully imported',
  uploadError:
    'Unable to import building block definition. Nothing was imported due to an error at our end.',
} as const;
