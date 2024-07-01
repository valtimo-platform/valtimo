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

import {PluginSpecification} from '../../models';
import {BesluitenApiConfigurationComponent} from './components/besluiten-api-configuration/besluiten-api-configuration.component';
import {BESLUITEN_API_PLUGIN_LOGO_BASE64} from './assets';
import {CreateZaakBesluitConfigurationComponent} from './components/create-zaak-besluit/create-zaak-besluit-configuration.component';
import {LinkDocumentToBesluitConfigurationComponent} from './components/link-document-to-besluit/link-document-to-besluit-configuration.component';

const besluitenApiPluginSpecification: PluginSpecification = {
  pluginId: 'besluitenapi',
  pluginConfigurationComponent: BesluitenApiConfigurationComponent,
  pluginLogoBase64: BESLUITEN_API_PLUGIN_LOGO_BASE64,
  functionConfigurationComponents: {
    'create-besluit': CreateZaakBesluitConfigurationComponent,
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
        'Ingangsdatum van de werkingsperiode van het besluit. Ondersteunt de value resolver, bijv: pv:ingangsdatum of doc:/besluit/ingangsdatum. Ondersteunende datum voorbeelden: 2024-04-01, 2024-04-01T12:10:00, 2024-04-01T12:10:06.069Z. Selecteer Tekst om de document of proces variabel property te gebruiken en Selectie om een datum uit een kalender te selecteren',
      vervaldatum: 'Vervaldatum',
      vervaldatumTooltip:
        'Datum waarop de werkingsperiode van het besluit eindigt. Ondersteunt de value resolver, bijv: pv:vervaldatum of doc:/besluit/vervaldatum. Ondersteunende datum voorbeelden: 2024-04-01, 2024-04-01T12:10:00, 2024-04-01T12:10:06.069Z. Selecteer Tekst om de document of proces variabel property te gebruiken en Selectie om een datum uit een kalender te selecteren',
      vervalreden: 'Vervalreden',
      vervalredenTooltip:
        'De omschrijving die aangeeft op grond waarvan het besluit is of komt te vervallen.',
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
        'Commencement date of the effective period of the besluit. Supports the value resolver eg: pv:ingangsdatum or doc:/besluit/ingangsdatum. Supporting date format examples: 2024-04-01, 2024-04-01T12:10:00, 2024-04-01T12:10:06.069Z. Select Text to use document or process variable property and Selection to select a date from a calendar.',
      vervaldatum: 'Expiration date',
      vervaldatumTooltip:
        'Date on which the period of operation of the besluit ends. Supports the value resolver eg: pv:vervaldatum or doc:/besluit/vervaldatum. Supporting date format examples: 2024-04-01, 2024-04-01T12:10:00, 2024-04-01T12:10:06.069Z. Select Text to use document or process variable property and Selection to select a date from a calendar.',
      vervalreden: 'Reason for expiry',
      vervalredenTooltip:
        'The description that indicates on the basis of which the decision has been or will be cancelled.',
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
    },
    de: {
      title: 'Besluiten API',
      rsin: 'RSIN',
      rsinTooltip: 'Informationsnummer für juristische Personen und Partnerschaften.',
      url: 'Besluiten API URL',
      urlTooltip: 'Die URL zur REST API von Besluiten',
      description:
        'API für die Speicherung und den Zugriff auf Entscheidungen und zugehörige Metadaten.',
      configurationTitle: 'Konfigurationsname',
      configurationTitleTooltip:
        'Der Name der aktuellen Plugin-Konfiguration. Unter diesem Namen ist die Konfiguration im Rest der Anwendung zu finden.',
      authenticationPluginConfiguration: 'Authentifizierungs-Plugin-Konfiguration',
      'create-besluit': 'Zaakbesluit erstellen',
      createZaakBesluitInformation: 'Diese Aktion erstellt eine Zaakbesluit in der Besluiten-API.',
      besluittypeUrl: 'Entscheidungstyp-URL',
      besluittypeUrlTooltip: 'URL-Referenz zum Entscheidungstyp',
      toelichting: 'Erläuterung',
      toelichtingTooltip: 'Begründung der Entscheidung.',
      bestuursorgaan: 'Leitungsgremium',
      bestuursorgaanTooltip:
        'Eine Körperschaft einer juristischen Person des öffentlichen Rechts oder eine Person oder Körperschaft einer öffentlichen Behörde, unter deren Verantwortung die Entscheidung getroffen wurde.',
      ingangsdatum: 'Anfangsdatum',
      ingangsdatumTooltip:
        'Datum des Beginns der Geltungsdauer der Entscheidung. Unterstützt den Werteauflöser, z. B.: pv:ingangsdatum oder doc:/besluit/ingangdatum. Beispiele für unterstützende Datumsformate: 2024-04-01, 2024-04-01T12:10:00, 2024-04-01T12:10:06.069Z. Wählen Sie Text, um die Dokument- oder Prozessvariableneigenschaft zu verwenden, und Auswahl, um ein Datum aus einem Kalender auszuwählen',
      vervaldatum: 'Verfallsdatum',
      vervaldatumTooltip:
        'Datum, an dem die Geltungsdauer der Entscheidung endet. Unterstützt den Werteauflöser, z. B.: pv:vervaldatum oder doc:/besluit/vervaldatum. Beispiele für unterstützende Datumsformate: 2024-04-01, 2024-04-01T12:10:00, 2024-04-01T12:10:06.069Z. Wählen Sie Text, um die Dokument- oder Prozessvariableneigenschaft zu verwenden, und Auswahl, um ein Datum aus einem Kalender auszuwählen',
      vervalreden: 'Ablaufgrund',
      vervalredenTooltip:
        'Die Beschreibung, auf deren Grundlage die Entscheidung aufgehoben wurde oder wird.',
      tijdelijk: 'Temporär',
      ingetrokken_overheid: 'Von der Regierung zurückgezogen',
      ingetrokken_belanghebbende: 'Von interessierter Partei zurückgezogen',
      publicatiedatum: 'Veröffentlichungsdatum',
      publicatiedatumTooltip: 'Datum, an dem die Entscheidung veröffentlicht wird.',
      verzenddatum: 'Versanddatum',
      verzenddatumTooltip: 'Datum, an dem die Entscheidung gesendet wurde.',
      uiterlijkeReactieDatum: 'Antwortfrist',
      uiterlijkeReactieDatumTooltip:
        'Das Datum, bis zu dem eine Verteidigung gegen die Entscheidung möglich ist.',
      besluitUrlProcessVariable: 'Prozessvariablenname mit Entscheidungs-URL',
      besluitUrlProcessVariableTooltip:
        'Hier muss der Name der Prozessvariable eingetragen werden, in der die Entscheidungs-URL lokal gespeichert wird',
      'link-document-to-besluit': 'Verknüpf Document zum Besluit',
      linkDocumentToBesluitInformation:
        'Diese Aktion verknüpft ein Dokument mit einer Fallentscheidung in der Besluiten API.',
      besluitUrl: 'Besluit URL',
      besluitUrlTooltip: 'URL-Referenz zum besluit',
      documentUrl: 'Document URL',
      documentUrlTooltip: 'URL-Referenz zum document',
      inputTypeBesluitToggle: 'Eingabetyp Besluit-URL',
      inputTypeStartingDateToggle: 'Eingabetyp Begindatum',
      inputTypeExpirationDateToggle: 'Eingabetyp Einddatum',
      text: 'Text',
      selection: 'Auswahl',
      caseDefinition: 'Falltyp',
      caseDefinitionTooltip:
        'Wählen Sie die Falltyp aus, aus der Sie einen Besluit-typ auswählen möchten. Wenn nur ein Besluit-typ verfügbar ist, wird dieser standardmäßig ausgewählt.',
      besluittypeUrlSelect: 'Besluittype',
      besluittypeUrlSelectTooltip: 'Wählen Sie den Besluit-typ aus.',
    },
  },
};

export {besluitenApiPluginSpecification};
