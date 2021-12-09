/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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

export class OpenZaakConfig {
  id: string;
  url: string;
  clientId: string;
  secret: string;
  rsin: string;
}

export class CreateOpenZaakConfigRequest {
  url: string;
  clientId: string;
  secret: string;
  rsin: string;
}

export class ModifyOpenZaakConfigRequest {
  url: string;
  clientId: string;
  secret: string;
  rsin: string;
}

export interface CreateOpenZaakConfigResult {
  openZaakConfig: OpenZaakConfig;
  errors: string[];
}

export interface ModifyOpenZaakConfigResult {
  openZaakConfig: OpenZaakConfig;
  errors: string[];
}

export interface ZaakType {
  url: string;
  omschrijving: string;
  omschrijvingGeneriek?: string;
}

export interface InformatieObjectType {
  url: string;
  omschrijving: string;
}

export interface InformatieObjectTypeLink {
  informatieObjectTypeLinkId: string;
  documentDefinitionName: string;
  zaakType: string;
  informatieObjectType: string;
}

export interface ZaakTypeLink {
  id: string;
  documentDefinitionName: string;
  zaakTypeUrl: string;
  zaakInstanceLinks: ZaakInstanceLink[];
  serviceTaskHandlers: ServiceTaskHandlerRequest[];
}

export interface ZaakTypeRequest {
  zaaktype: string;
}

export interface CreateZaakTypeLinkRequest {
  documentDefinitionName: string;
  zaakTypeUrl: string;
}

export interface CreateInformatieObjectTypeLinkRequest {
  documentDefinitionName: string;
  zaakType: string;
  informatieObjectType: string;
}

export interface ZaakInstanceLink {
  zaakInstanceUrl: string;
  zaakInstanceId: string;
  documentId: string;
}

export interface ServiceTaskHandlerRequest {
  serviceTaskId: string;
  operation: Operation;
  parameter: string;
}

export interface PreviousSelectedZaak {
  zaakTypeLink: ZaakTypeLink;
  zaakType: ZaakType;
  serviceTaskHandler: ServiceTaskHandlerRequest;
}

export interface ZaakOperation {
  type: string;
  label: string;
}

export interface ZaakStatusType {
  url?: string;
  omschrijving: string;
  omschrijvingGeneriek?: string;
  statustekst?: string;
  zaakType: string;
  volgnummer: number;
  isEindStatus?: boolean;
  informeren?: boolean;
}

export interface ZaakResultType {
  url?: string;
  zaaktype: string;
  omschrijving: string;
  resultaattypeomschrijving: string;
  omschrijvingGeneriek?: string;
  selectielijstklasse: string;
  toelichting?: string;
  archiefnominatie?: Archiefnominatie;
  archiefactietermijn?: string;
  brondatumArchiefprocedure?: BrondatumArchiefprocedure;
}

export interface BrondatumArchiefprocedure {
  afleidingswijze: Afleidingswijze;
  datumkenmerk?: string;
  einddatumBekend?: boolean;
  objecttype?: Objecttype;
  registratie?: string;
  procestermijn?: string;
}

export enum Archiefnominatie {
  blijvend_bewaren = 'blijven_bewaren',
  vernietigen = 'vernietigen'
}

export enum Afleidingswijze {
  afgehandeld = 'afgehandeld',
  ander_datumkenmerk = 'ander_datumkenmerk',
  eigenschap = 'eigenschap',
  gerelateerde_zaak = 'gerelateerde_zaak',
  hoofdzaak = 'hoofdzaak',
  ingangsdatum_besluit = 'ingangsdatum_besluit',
  termijn = 'termijn',
  vervaldatum_besluit = 'vervaldatum_besluit',
  zaakobject = 'zaakobject'
}

export enum Objecttype {
  adres = 'adres',
  besluit = 'besluit',
  buurt = 'buurt',
  enkelvoudig_document = 'enkelvoudig_document',
  gemeente = 'gemeente',
  gemeentelijke_openbare_ruimte = 'gemeentelijke_openbare_ruimte',
  huishouden = 'huishouden',
  inrichtingselement = 'inrichtingselement',
  kadastrale_onroerende_zaak = 'kadastrale_onroerende_zaak',
  kunstwerkdeel = 'kunstwerkdeel',
  maatschappelijke_activiteit = 'maatschappelijke_activiteit',
  medewerker = 'medewerker',
  natuurlijk_persoon = 'natuurlijk_persoon',
  niet_natuurlijk_persoon = 'niet_natuurlijk_persoon',
  openbare_ruimte = 'openbare_ruimte',
  organisatorische_eenheid = 'organisatorische_eenheid',
  pand = 'pand',
  spoorbaandeel = 'spoorbaandeel',
  status = 'status',
  terreindeel = 'terreindeel',
  terrein_gebouwd_object = 'terrein_gebouwd_object',
  vestiging = 'vestiging',
  waterdeel = 'waterdeel',
  wegdeel = 'wegdeel',
  wijk = 'wijk',
  woonplaats = 'woonplaats',
  woz_deelobject = 'woz_deelobject',
  woz_object = 'woz_object',
  woz_waarde = 'woz_waarde',
  zakelijk_recht = 'zakelijk_recht',
  overige = 'overige'
}

export enum Operation {
  CREATE_ZAAK = 'CREATE_ZAAK',
  SET_RESULTAAT = 'SET_RESULTAAT',
  SET_STATUS = 'SET_STATUS'
}
