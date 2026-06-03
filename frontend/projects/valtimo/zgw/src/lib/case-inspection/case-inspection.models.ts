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

interface ZaakInstanceLinkDto {
  zaakInstanceUrl: string;
  zaakInstanceId: string;
  zaakTypeUrl: string;
}

interface ZaakEigenschapDto {
  url: string;
  eigenschap: string;
  naam: string | null;
  waarde: string;
}

interface ZaakRolDto {
  url: string | null;
  betrokkeneType: string;
  roltype: string;
  omschrijving: string | null;
  omschrijvingGeneriek: string | null;
  indicatieMachtiging: string | null;
  betrokkeneIdentificatie: Record<string, unknown> | null;
}

interface ZaakStatusDto {
  url: string;
  statustype: string;
  datumStatusGezet: string;
  statustoelichting: string | null;
}

interface ZaakResultaatDto {
  url: string;
  resultaattype: string;
  toelichting: string | null;
}

interface ZaakObjectDto {
  url: string;
  objectUrl: string;
  objectType: string;
  objectTypeOverige: string | null;
  relatieomschrijving: string | null;
}

interface ZaakInformatieObjectDto {
  url: string;
  informatieobject: string;
  titel: string | null;
  registratiedatum: string;
}

interface ZaakBesluitDto {
  url: string;
  besluit: string;
}

interface CaseZgwInspectionDto {
  zaakInstanceLink: ZaakInstanceLinkDto | null;
  zaak: Record<string, unknown> | null;
  eigenschappen: ZaakEigenschapDto[];
  rollen: ZaakRolDto[];
  statusHistory: ZaakStatusDto[];
  resultaat: ZaakResultaatDto | null;
  zaakObjecten: ZaakObjectDto[];
  zaakInformatieObjecten: ZaakInformatieObjectDto[];
  besluiten: ZaakBesluitDto[];
  warnings: string[];
}

interface ZaakobjectResolveResultDto {
  resolved: boolean;
  record: Record<string, unknown> | null;
  message: string | null;
  objectUrl: string;
}

interface ZaakdetailsSyncConfigDto {
  caseDefinitionKey: string;
  caseDefinitionVersionTag: string;
  objectManagementConfigurationId: string | null;
  objectManagementTitle: string | null;
  enabled: boolean;
}

interface ZaakdetailsObjectDto {
  documentId: string;
  objectUrl: string;
  linkedToZaak: boolean;
}

interface CaseZaakdetailsInspectionDto {
  syncConfig: ZaakdetailsSyncConfigDto | null;
  zaakdetailsObject: ZaakdetailsObjectDto | null;
  warnings: string[];
}

interface ZaakdetailsObjectContentDto {
  resolved: boolean;
  record: Record<string, unknown> | null;
  message: string | null;
  objectUrl: string | null;
}

export {
  ZaakInstanceLinkDto,
  ZaakEigenschapDto,
  ZaakRolDto,
  ZaakStatusDto,
  ZaakResultaatDto,
  ZaakObjectDto,
  ZaakInformatieObjectDto,
  ZaakBesluitDto,
  CaseZgwInspectionDto,
  ZaakobjectResolveResultDto,
  ZaakdetailsSyncConfigDto,
  ZaakdetailsObjectDto,
  CaseZaakdetailsInspectionDto,
  ZaakdetailsObjectContentDto,
};
