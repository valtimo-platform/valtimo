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

import {DocumentenApiMetadata} from '../models';
import {
  DocumentenApiUploadField,
  DocumentenApiUploadFields,
} from '../models/documenten-api-upload-field.model';

const UPLOAD_FORM_FIELD_KEYS: Array<string> = [
  'aanvullendeDatum',
  'auteur',
  'vertrouwelijkheidaanduiding',
  'creatiedatum',
  'beschrijving',
  'titel',
  'informatieobjecttype',
  'bestandsnaam',
  'taal',
  'status',
  'trefwoorden',
];

const areAllUploadFieldsHidden = (hideFields: Array<string> = []): boolean =>
  UPLOAD_FORM_FIELD_KEYS.every(key => hideFields.includes(key));

const filenameToTitle = (filename?: string): string | null => {
  if (!filename) return null;

  const title = filename.replace(/\.[^/.]+$/, '').replace(/[._]/g, ' ');
  return title.charAt(0).toUpperCase() + title.slice(1);
};

// A name that is only an extension (.env) derives an empty title, and a batch has no Title field to fill one in.
const getBatchFileTitle = (filename: string): string => filenameToTitle(filename) || filename;

const getFilenameExtension = (filename?: string): string => {
  const extension = filename?.split('.')?.pop() || '';
  return extension.length === filename?.length ? '' : extension;
};

const withFilenameExtension = (filename: string, extension: string): string =>
  extension ? `${filename.replace(/\.[^/.]+$/, '')}.${extension}` : filename;

const getEnforcedDefaultValue = (field?: DocumentenApiUploadField): string | undefined =>
  field?.defaultValue && (field.readonly || !field.visible) ? field.defaultValue : undefined;

// Batch files get their own filename and title unless the admin enforced a default the user could not change either.
const getBatchFileMetadata = (
  file: File,
  sharedMetadata: DocumentenApiMetadata,
  uploadFields: DocumentenApiUploadFields | null
): DocumentenApiMetadata => {
  const enforcedFilename = getEnforcedDefaultValue(uploadFields?.bestandsnaam);

  return {
    ...sharedMetadata,
    bestandsnaam: enforcedFilename
      ? withFilenameExtension(enforcedFilename, getFilenameExtension(file.name))
      : file.name,
    titel: getEnforcedDefaultValue(uploadFields?.titel) || getBatchFileTitle(file.name),
  };
};

export {
  areAllUploadFieldsHidden,
  filenameToTitle,
  getBatchFileMetadata,
  getBatchFileTitle,
  getFilenameExtension,
  withFilenameExtension,
};
