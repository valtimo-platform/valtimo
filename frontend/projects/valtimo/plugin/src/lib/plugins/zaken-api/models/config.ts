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

import {PluginConfigurationData} from '../../../models';
import {InputOption} from './input';

interface ZakenApiConfig extends PluginConfigurationData {
  url: string;
  authenticationPluginConfiguration: string;
}

interface LinkDocumentToZaakConfig {
  documentUrl: string;
  titel: string;
  beschrijving: string;
  vernietigingsdatum?: string;
  statusUrl?: string;
}

interface GetZaakInformatieobjectenConfig {
  resultProcessVariable: string;
}

interface SetZaakStatusConfig {
  statustypeUrl: string;
  statustoelichting: string;
  inputTypeZaakStatusToggle?: InputOption;
  inputDatumStatusGezetToggle?: string;
  datumStatusGezet?: string;
}

interface CreateZaakResultaatConfig {
  resultaattypeUrl: string;
  toelichting: string;
  inputTypeZaakResultaatToggle?: InputOption;
}

interface CreateNatuurlijkePersoonZaakRolConfig {
  roltypeUrl: string;
  rolToelichting: string;
  inpBsn: string;
  anpIdentificatie: string;
  inpA_nummer: string;
  resultProcessVariable?: string;
}

interface CreateNietNatuurlijkePersoonZaakRolConfig {
  roltypeUrl: string;
  rolToelichting: string;
  innNnpId: string;
  annIdentificatie: string;
  kvkNummer?: string;
  vestigingsNummer?: string;
  resultProcessVariable?: string;
}

interface CreateMedewerkerZaakRolConfig {
  roltypeUrl: string;
  rolToelichting: string;
  identificatie?: string;
  achternaam?: string;
  voorletters?: string;
  voorvoegselAchternaam?: string;
  afwijkendeNaamBetrokkene?: string;
  indicatieMachtiging?: string;
  resultProcessVariable?: string;
}

interface CreateOrganisatorischeEenheidZaakRolConfig {
  roltypeUrl: string;
  rolToelichting: string;
  identificatie?: string;
  naam?: string;
  isGehuisvestIn?: string;
  afwijkendeNaamBetrokkene?: string;
  indicatieMachtiging?: string;
  resultProcessVariable?: string;
}

interface CreateVestigingZaakRolConfig {
  roltypeUrl: string;
  rolToelichting: string;
  handelsnaam?: string;
  kvkNummer?: string;
  vestigingsNummer?: string;
  resultProcessVariable?: string;
}

interface DeleteZaakRolConfig {
  rolUuid: string;
}

interface CreateZaakConfig {
  rsin: string;
  manualZaakTypeUrl: boolean;
  zaaktypeUrl: string;
  inputTypeZaakTypeToggle?: InputOption;
  archiveActionDate?: string;
  archiveNomination?: string;
  archiveStatus?: string;
  caseGeometryCoordinates?: string;
  caseGeometryType?: string;
  characteristics?: string;
  commissioningOrganisation?: string;
  communicationChannel?: string;
  communicationChannelName?: string;
  confidentiality?: string;
  description?: string;
  explanation?: string;
  extensionDuration?: string;
  extensionReason?: string;
  finalDeliveryDate?: string;
  identification?: string;
  lastOpenedDate?: string;
  lastPaymentDate?: string;
  mainCase?: string;
  paymentIndication?: string;
  plannedEndDate?: string;
  processObjectCategory?: string;
  processObjectDateAttribute?: string;
  processObjectIdentification?: string;
  processObjectObjectType?: string;
  processObjectRegistration?: string;
  productsAndServices?: string;
  publicationDate?: string;
  registrationDate?: string;
  relatedCases?: string;
  relevantOtherCases?: string;
  selectionListClass?: string;
  startDateRetentionPeriod?: string;
  suspensionIndication?: string;
  suspensionReason?: string;
}

interface SetZaakopschortingConfig {
  verlengingsduur: string;
  toelichtingVerlenging: string;
  toelichtingOpschorting: string;
}

interface StartHersteltermijnConfig {
  maxDurationInDays: string;
}

interface CreateZaakeigenschapConfig {
  eigenschapUrl: string;
  eigenschapValue: string;
  inputTypeEigenschapToggle?: InputOption;
}

interface UpdateZaakeigenschapConfig {
  eigenschapUrl: string;
  eigenschapValue: string;
  inputTypeEigenschapToggle?: InputOption;
}

interface DeleteZaakeigenschapConfig {
  eigenschapUrl: string;
  inputTypeEigenschapToggle?: InputOption;
}

interface PatchZaakConfig {
  description?: string;
  explanation?: string;
  startDate?: string;
  plannedEndDate?: string;
  finalDeliveryDate?: string;
  publicationDate?: string;
  communicationChannel?: string;
  communicationChannelName?: string;
  paymentIndication?: string;
  lastPaymentDate?: string;
  caseGeometryType?: string;
  caseGeometryCoordinates?: string;
  mainCase?: string;
  archiveActionDate?: string;
  startDateRetentionPeriod?: string;
}

interface RelateerZakenConfig {
  teRelaterenZaakUri: string;
  aardRelatie: string;
}

interface GetZaakbesluitenConfig {
  resultProcessVariable: string;
}

interface CreateZaakNotitieConfig {
  onderwerp: string;
  tekst: string;
  aangemaaktDoor?: string;
  notitieType?: string;
  status?: string;
}

interface PatchZaakNotitieConfig {
  zaakNotitieUrl: string;
  onderwerp?: string;
  tekst?: string;
  aangemaaktDoor?: string;
  notitieType?: string;
  status?: string;
}

export interface PropertyFormField {
  type?: string;
  name: string;
  translationKey: string;
  tooltipTranslationKey?: string;
  presetOptions?: string[];
}

export {
  ZakenApiConfig,
  LinkDocumentToZaakConfig,
  GetZaakInformatieobjectenConfig,
  SetZaakStatusConfig,
  CreateZaakResultaatConfig,
  CreateZaakConfig,
  CreateNatuurlijkePersoonZaakRolConfig,
  CreateNietNatuurlijkePersoonZaakRolConfig,
  CreateMedewerkerZaakRolConfig,
  CreateOrganisatorischeEenheidZaakRolConfig,
  CreateVestigingZaakRolConfig,
  DeleteZaakRolConfig,
  SetZaakopschortingConfig,
  StartHersteltermijnConfig,
  CreateZaakeigenschapConfig,
  UpdateZaakeigenschapConfig,
  DeleteZaakeigenschapConfig,
  PatchZaakConfig,
  RelateerZakenConfig,
  GetZaakbesluitenConfig,
  CreateZaakNotitieConfig,
  PatchZaakNotitieConfig,
};
