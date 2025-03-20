/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

interface DocumentenApiUploadField {
  key: DOCUMENTEN_API_UPLOAD_KEYS;
  defaultValue?: string;
  visible?: boolean;
  readonly?: boolean;
}

interface DocumentenApiUploadFieldDefaultValues {
  auteur?: string;
  vertrouwelijkheidaanduiding?: string;
  beschrijving?: string;
  titel?: string;
  informatieobjecttype?: string;
  bestandsnaam?: string;
  taal?: string;
  status?: string;
  trefwoorden?: string[];
}

interface DocumentenApiUploadFields {
  auteur?: DocumentenApiUploadField;
  vertrouwelijkheidaanduiding?: DocumentenApiUploadField;
  beschrijving?: DocumentenApiUploadField;
  titel?: DocumentenApiUploadField;
  informatieobjecttype?: DocumentenApiUploadField;
  bestandsnaam?: DocumentenApiUploadField;
  taal?: DocumentenApiUploadField;
  status?: DocumentenApiUploadField;
  trefwoorden?: DocumentenApiUploadField;
}

enum DOCUMENTEN_API_UPLOAD_KEYS {
  BESTANDSNAAM = 'bestandsnaam',
  TITEL = 'titel',
  AUTEUR = 'auteur',
  BESCHRIJVING = 'beschrijving',
  TAAL = 'taal',
  VERTROUWELIJKHEIDAANDUIDING = 'vertrouwelijkheidaanduiding',
  CREATIEDATUM = 'creatiedatum',
  INFORMATIEOBJECTTYPE = 'informatieobjecttype',
  STATUS = 'status',
  VERZENDDATUM = 'verzenddatum',
  ONTVANGSTDATUM = 'ontvangstdatum',
  AANVULLENDE_DATUM = 'aanvullendeDatum',
  TREFWOORDEN = 'trefwoorden',
}

export {
  DocumentenApiUploadField,
  DocumentenApiUploadFieldDefaultValues,
  DocumentenApiUploadFields,
  DOCUMENTEN_API_UPLOAD_KEYS,
};
