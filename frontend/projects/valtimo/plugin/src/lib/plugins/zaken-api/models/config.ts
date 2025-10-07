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
}

interface SetZaakStatusConfig {
  statustypeUrl: string;
  statustoelichting: string;
  inputTypeZaakStatusToggle?: InputOption;
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
}

interface CreateNietNatuurlijkePersoonZaakRolConfig {
  roltypeUrl: string;
  rolToelichting: string;
  innNnpId: string;
  annIdentificatie: string;
  kvkNummer?: string;
  vestigingsNummer?: string;
}

interface CreateMedewerkerZaakRolConfig {
  roltypeUrl: string;
  rolToelichting: string;
  identificatie: string;
  achternaam: string;
  voorletters: string;
  voorvoegselAchternaam?: string;
  afwijkendeNaamBetrokkene?: string;
  indicatieMachtiging?: string;
}

interface CreateOrganisatorischeEenheidZaakRolConfig {
  roltypeUrl: string;
  rolToelichting: string;
  identificatie: string;
  naam: string;
  isGehuisvestIn: string;
  afwijkendeNaamBetrokkene?: string;
  indicatieMachtiging?: string;
}

interface CreateVestigingZaakRolConfig {
  roltypeUrl: string;
  rolToelichting: string;
  handelsnaam?: string;
  kvkNummer: string;
  vestigingsNummer: string;
}

interface CreateZaakConfig {
  rsin: string;
  manualZaakTypeUrl: boolean;
  zaaktypeUrl: string;
  inputTypeZaakTypeToggle?: InputOption;
  description?: string;
  explanation?: string;
  plannedEndDate?: string;
  finalDeliveryDate?: string;
  communicationChannel?: string;
  paymentIndication?: string;
  caseGeometryType?: string;
  caseGeometryCoordinates?: string,
  mainCase?: string;
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

export {
  ZakenApiConfig,
  LinkDocumentToZaakConfig,
  SetZaakStatusConfig,
  CreateZaakResultaatConfig,
  CreateZaakConfig,
  CreateNatuurlijkePersoonZaakRolConfig,
  CreateNietNatuurlijkePersoonZaakRolConfig,
  CreateMedewerkerZaakRolConfig,
  CreateOrganisatorischeEenheidZaakRolConfig,
  CreateVestigingZaakRolConfig,
  SetZaakopschortingConfig,
  StartHersteltermijnConfig,
  CreateZaakeigenschapConfig,
  UpdateZaakeigenschapConfig,
  DeleteZaakeigenschapConfig,
  PatchZaakConfig,
  RelateerZakenConfig,
};
