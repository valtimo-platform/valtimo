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

import {PluginSpecification} from '../../models';
import {BesluitenApiConfigurationComponent} from './components/besluiten-api-configuration/besluiten-api-configuration.component';
import {BESLUITEN_API_PLUGIN_LOGO_BASE64} from './assets';
import {CreateZaakBesluitConfigurationComponent} from './components/create-zaak-besluit/create-zaak-besluit-configuration.component';
import {PatchZaakBesluitConfigurationComponent} from './components/patch-zaak-besluit/patch-zaak-besluit-configuration.component';
import {LinkDocumentToBesluitConfigurationComponent} from './components/link-document-to-besluit/link-document-to-besluit-configuration.component';

const besluitenApiPluginSpecification: PluginSpecification = {
  pluginId: 'besluitenapi',
  pluginConfigurationComponent: BesluitenApiConfigurationComponent,
  pluginLogoBase64: BESLUITEN_API_PLUGIN_LOGO_BASE64,
  functionConfigurationComponents: {
    'create-besluit': CreateZaakBesluitConfigurationComponent,
    'patch-besluit': PatchZaakBesluitConfigurationComponent,
    'link-document-to-besluit': LinkDocumentToBesluitConfigurationComponent,
  },
  pluginTranslations: {
    nl: {
      title: 'Besluiten API',
      rsin: 'RSIN',
      rsinTooltip: 'Rechtspersonen en Samenwerkingsverbanden Informatienummer',
      url: 'Besluiten API URL',
      urlTooltip: 'Een URL naar de REST API van Besluiten',
      description: 'API voor opslag en ontsluiting van besluiten en daarbij behorende metadata.',
      configurationTitle: 'Configuratienaam',
      configurationTitleTooltip:
        'De naam van de huidige plugin-configuratie. Onder deze naam kan de configuratie in de rest van de applicatie teruggevonden worden.',
      authenticationPluginConfiguration: 'Configuratie authenticatie-plug-in',
      'create-besluit': 'Zaakbesluit aanmaken',
      createZaakBesluitInformation: 'Deze actie creëert een zaakbesluit in de Besluiten API.',
      besluittypeUrl: 'Besluittype-URL',
      besluittypeUrlTooltip: 'URL-referentie naar het besluittype',
      toelichting: 'Toelichting',
      toelichtingTooltip: 'Toelichting bij het besluit.',
      bestuursorgaan: 'Bestuursorgaan',
      bestuursorgaanTooltip:
        'Een orgaan van een rechtspersoon krachtens publiekrecht ingesteld of een persoon of college, met enig openbaar gezag bekleed onder wiens verantwoordelijkheid het besluit vastgesteld is.',
      ingangsdatum: 'Ingangsdatum',
      ingangsdatumTooltip:
        'Ingangsdatum van de werkingsperiode van het besluit. Ondersteunt de value resolver, bijv: pv:ingangsdatum of doc:/besluit/ingangsdatum. Ondersteunende datum voorbeelden: 2024-04-01, 2024-04-01T12:10:00, 2024-04-01T12:10:06.069Z',
      vervaldatum: 'Vervaldatum',
      vervaldatumTooltip:
        'Datum waarop de werkingsperiode van het besluit eindigt. Ondersteunt de value resolver, bijv: pv:vervaldatum of doc:/besluit/vervaldatum. Ondersteunende datum voorbeelden: 2024-04-01, 2024-04-01T12:10:00, 2024-04-01T12:10:06.069Z.',
      vervalreden: 'Vervalreden',
      vervalredenTooltip:
        'De omschrijving die aangeeft op grond waarvan het besluit is of komt te vervallen. Mogelijke waarden: tijdelijk, ingetrokken_overheid, ingetrokken_belanghebbende',
      tijdelijk: 'Tijdelijk',
      ingetrokken_overheid: 'Ingetrokken door overheid',
      ingetrokken_belanghebbende: 'Ingetrokken door belanghebbende',
      publicatiedatum: 'Publicatiedatum',
      publicatiedatumTooltip: 'Datum waarop het besluit gepubliceerd wordt.',
      verzenddatum: 'Verzenddatum',
      verzenddatumTooltip: 'Datum waarop het besluit verzonden is.',
      uiterlijkeReactieDatum: 'Uiterlijke reactie datum',
      uiterlijkeReactieDatumTooltip: 'De datum tot wanneer verweer tegen het besluit mogelijk is.',
      besluitUrlProcessVariable: 'Naam procesvariabele met besluit URL',
      besluitUrlProcessVariableTooltip:
        'Hier moet de naam van de procesvariabele ingevuld worden waarin de besluit URL lokaal staat opgeslagen',
      'link-document-to-besluit': 'Link Document aan Besluit',
      linkDocumentToBesluitInformation:
        'Deze actie linkt een document aan een zaakbesluit in de Besluiten API.',
      besluitUrl: 'Besluit URL',
      besluitUrlTooltip: 'URL-referentie naar het besluit',
      documentUrl: 'Document URL',
      documentUrlTooltip: 'URL-referentie naar het document',
      inputTypeBesluitToggle: 'Invoertype Besluit-URL',
      inputTypeStartingDateToggle: 'Invoertype Begindatum',
      inputTypeExpirationDateToggle: 'Invoertype vervaldatum',
      text: 'Tekst',
      selection: 'Selectie',
      caseDefinition: 'Dossierdefinitie',
      caseDefinitionTooltip:
        'Selecteer de dossierdefinitie waarvan u een Besluit-type wilt selecteren. Als er slechts één besluittype beschikbaar is, wordt deze standaard geselecteerd.',
      besluittypeUrlSelect: 'Besluittype',
      besluittypeUrlSelectTooltip: 'Selecteer het besluittype.',
      'patch-besluit': 'Zaakbesluit bijwerken',
      patchZaakBesluitInformation: 'Deze actie wijzigt een zaakbesluit in de Besluiten API.',
      beslisdatum: 'Beslisdatum',
      beslisdatumTooltip:
        'De beslisdatum (AWB) van het besluit. Ondersteunt value resolver. Ondersteunende datum voorbeelden: 2024-04-01, 2024-04-01T12:10:00, 2024-04-01T12:10:06.069Z',
      addPatchBesluitProperty: 'Voeg nieuwe parameter toe',
    },
    en: {
      title: 'Besluiten API',
      rsin: 'RSIN',
      rsinTooltip: 'Legal Entities and Partnerships Information Number',
      url: 'Besluiten API URL',
      urlTooltip: 'A URL to the REST API of Besluiten',
      description: 'API for storage and access to decisions and associated metadata.',
      configurationTitle: 'Configuration name',
      configurationTitleTooltip:
        'The name of the current plugin configuration. Under this name, the configuration can be found in the rest of the application.',
      authenticationPluginConfiguration: 'Authentication plugin configuration',
      'create-besluit': 'Create Zaakbesluit',
      createZaakBesluitInformation: 'This action creates a Zaakbesluit in the Besluiten API.',
      besluittypeUrl: 'Besluit type URL',
      besluittypeUrlTooltip: 'URL reference to the besluit type',
      toelichting: 'Explanation',
      toelichtingTooltip: 'Explanation to the besluit.',
      bestuursorgaan: 'Governing body',
      bestuursorgaanTooltip:
        'A body of a legal person established under public law or a person or body with any public authority under whose responsibility the decision has been adopted.',
      ingangsdatum: 'Starting date',
      ingangsdatumTooltip:
        'Commencement date of the effective period of the besluit. Supports the value resolver eg: pv:ingangsdatum or doc:/besluit/ingangsdatum. Supporting date format examples: 2024-04-01, 2024-04-01T12:10:00, 2024-04-01T12:10:06.069Z.',
      vervaldatum: 'Expiration date',
      vervaldatumTooltip:
        'Date on which the period of operation of the besluit ends. Supports the value resolver eg: pv:vervaldatum or doc:/besluit/vervaldatum. Supporting date format examples: 2024-04-01, 2024-04-01T12:10:00, 2024-04-01T12:10:06.069Z.',
      vervalreden: 'Reason for expiry',
      vervalredenTooltip:
        'The description that indicates on the basis of which the decision has been or will be cancelled. Possible value: tijdelijk, ingetrokken_overheid, ingetrokken_belanghebbende',
      tijdelijk: 'Temporary',
      ingetrokken_overheid: 'Withdrawn by government',
      ingetrokken_belanghebbende: 'Withdrawn by interested party',
      publicatiedatum: 'Publication date',
      publicatiedatumTooltip: 'Date on which the besluit is published.',
      verzenddatum: 'Shipment date',
      verzenddatumTooltip: 'Date on which the besluit was sent.',
      uiterlijkeReactieDatum: 'Response deadline',
      uiterlijkeReactieDatumTooltip:
        'The date until which a defense against the decision is possible.',
      besluitUrlProcessVariable: 'Process variable name with besluit URL',
      besluitUrlProcessVariableTooltip:
        'Here must be entered the name of the process variable in which the besluit URL is stored locally',
      'link-document-to-besluit': 'Link Document to Besluit',
      linkDocumentToBesluitInformation:
        'This action links a document to a zaakbesluit in the Besluiten API.',
      besluitUrl: 'Besluit URL',
      besluitUrlTooltip: 'URL reference to the besluit',
      documentUrl: 'Document URL',
      documentUrlTooltip: 'URL reference to the document',
      inputTypeBesluitToggle: 'Input type Besluit-URL',
      inputTypeStartingDateToggle: 'Input type start date',
      inputTypeExpirationDateToggle: 'Input type expiration date',
      text: 'Text',
      selection: 'Selection',
      caseDefinition: 'Case definition',
      caseDefinitionTooltip:
        'Select the case definition from which you want to select a Besluit type. If only one Besluit type is available, it will be selected by default.',
      besluittypeUrlSelect: 'Besluittype',
      besluittypeUrlSelectTooltip: 'Select the Besluit type.',
      'patch-besluit': 'Patch Zaakbesluit',
      patchZaakBesluitInformation: 'This action patches a Zaakbesluit in the Besluiten API.',
      beslisdatum: 'Decision date',
      beslisdatumTooltip:
        'The decision date (AWB) of the decision. Supports value resolver. Supported date examples: 2024-04-01, 2024-04-01T12:10:00, 2024-04-01T12:10:06.069Z',
      addPatchBesluitProperty: 'Add besluit property',
    },
  },
};

export {besluitenApiPluginSpecification};
