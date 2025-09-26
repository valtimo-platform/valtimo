/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

import {RelatedFile} from '@valtimo/document';

interface DocumentenApiRelatedFile extends RelatedFile {
  auteur?: string;
  beschrijving?: string;
  bestandsnaam?: string;
  bestandsomvang?: number;
  bronorganisatie?: string;
  creatiedatum?: Date;
  formaat?: string;
  identificatie?: string;
  informatieobjecttype?: string;
  locked?: boolean;
  status?: string;
  taal?: string;
  titel?: String;
  trefwoorden?: string[];
  versie?: number;
  vertrouwelijkheidaanduiding?: string;
  tags?: {content: string}[];
}

enum DOCUMENTEN_COLUMN_KEYS {
  AUTEUR = 'auteur',
  BESCHRIJVING = 'beschrijving',
  BESTANDSNAAM = 'bestandsnaam',
  BESTANDSOMVANG = 'bestandsomvang',
  BRONORGANISATIE = 'bronorganisatie',
  CREATIEDATUM = 'creatiedatum',
  FORMAAT = 'formaat',
  IDENTIFICATIE = 'identificatie',
  INFORMATIEOBJECTTYPE = 'informatieobjecttype',
  LOCKED = 'locked',
  STATUS = 'status',
  TAAL = 'taal',
  TITEL = 'titel',
  TREFWOORDEN = 'trefwoorden',
  VERSIE = 'versie',
  VERTROUWELIJKHEIDAANDUIDING = 'vertrouwelijkheidaanduiding',
  TAGS = 'tags',
}

export {DocumentenApiRelatedFile, DOCUMENTEN_COLUMN_KEYS};
