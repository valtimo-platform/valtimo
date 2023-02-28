/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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
import {ZAKEN_API_PLUGIN_LOGO_BASE64} from './assets';
import {LinkDocumentToZaakConfigurationComponent} from './components/link-document-to-zaak/link-document-to-zaak-configuration.component';
import {ZakenApiConfigurationComponent} from './components/zaken-api-configuration/zaken-api-configuration.component';
import {LinkUploadedDocumentToZaakConfigurationComponent} from './components/link-uploaded-document-to-zaak/link-uploaded-document-to-zaak-configuration.component';
import {CreateNatuurlijkPersoonZaakRolComponent} from './components/create-natuurlijk-persoon-zaak-rol/create-natuurlijk-persoon-zaak-rol.component';
import {CreateZaakConfigurationComponent} from './components/create-zaak/create-zaak-configuration.component';

const zakenApiPluginSpecification: PluginSpecification = {
  pluginId: 'zakenapi',
  pluginConfigurationComponent: ZakenApiConfigurationComponent,
  pluginLogoBase64: ZAKEN_API_PLUGIN_LOGO_BASE64,
  functionConfigurationComponents: {
    'link-document-to-zaak': LinkDocumentToZaakConfigurationComponent,
    'link-uploaded-document-to-zaak': LinkUploadedDocumentToZaakConfigurationComponent,
    'create-zaak': CreateZaakConfigurationComponent,
    'create-natuurlijk-persoon-zaak-rol': CreateNatuurlijkPersoonZaakRolComponent,
  },
  pluginTranslations: {
    nl: {
      title: 'Zaken API',
      url: 'Zaken API URL',
      urlTooltip:
        'In dit veld moet de verwijzing komen naar de REST api van Open zaak. Deze url moet dus eindigen op /zaken/api/v1/',
      description:
        'De API ondersteunt het opslaan en het naar andere applicaties ontsluiten van gegevens over alle gemeentelijke zaken, van elk type.',
      'link-document-to-zaak': 'Koppel document aan zaak',
      'link-uploaded-document-to-zaak': 'Koppel geupload document aan zaak',
      linkUploadedDocumentToZaakMessage:
        'Het koppelen van een geupload document aan een zaak heeft geen configuratie nodig.',
      configurationTitle: 'Configuratienaam',
      configurationTitleTooltip:
        'Onder deze naam zal de plugin te herkennen zijn in de rest van de applicatie',
      documentUrl: 'URL naar het document',
      documentUrlTooltip:
        'Dit veld ondersteunt URLs en proces variabelen. Gebruik pv:variable om een proces variabele uit te lezen',
      titel: 'Documenttitel',
      titelTooltip:
        '(Optioneel) Vult het titel veld in de metadata van de link tussen de Zaak en het Document',
      beschrijving: 'Documentbeschrijving',
      beschrijvingTooltip:
        '(Optioneel) Vult het beschrijving veld in de metadata van de link tussen de Zaak en het Document',
      authenticationPluginConfiguration: 'Configuratie authenticatie-plug-in',
      authenticationPluginConfigurationTooltip:
        'Selecteer de plugin die de authenticatie kan afhandelen. Wanneer de selectiebox leeg blijft zal de authenticatie plugin (bv. OpenZaak) eerst aangemaakt moeten worden',
      linkDocumentInformation:
        'Deze actie koppelt een document uit de Documenten API aan de zaak die bij het dossier hoort.',
      'create-zaak': 'Zaak aanmaken',
      createZaakInformation:
        'Deze actie creëert een zaak in de Zaken API en koppeld de nieuwe zaak aan het dossier.',
      rsin: 'RSIN',
      rsinTooltip: 'Rechtspersonen en Samenwerkingsverbanden Informatienummer',
      zaakType: 'Zaaktype',
      zaakTypeTooltip: 'In dit veld moet de verwijzing komen naar de type zaak.',
      inputTypeZaakTypeToggle: 'Invoertype Zaaktype-URL',
      text: 'Tekst',
      selection: 'Selectie',
      'create-natuurlijk-persoon-zaak-rol': 'Zaakrol aanmaken - natuurlijk persoon',
      roltypeUrl: 'Roltype URL',
      rolToelichting: 'Roltoelichting',
      inpBsn: 'Initiator BSN',
      anpIdentificatie: 'Ander natuurlijk persoon identificatie',
      inpA_nummer: 'Administratienummer persoon',
      roltypeUrlTooltip: 'URL naar een roltype binnen het Zaaktype van een Zaak',
      rolToelichtingTooltip: 'Omschrijving van de aard van de rol',
      inpBsnTooltip: 'Het burgerservicenummer van de initiator',
      anpIdentificatieTooltip:
        'Het door de gemeente uitgegeven unieke nummer voor een ander natuurlijk persoon',
      inpA_nummerTooltip: 'Het administratienummer van de persoon, bedoeld in de Wet BRP',
    },
    en: {
      title: 'Zaken API',
      url: 'URL',
      urlTooltip:
        'This field must contain the URL to the rest API of Open Zaak, therefore this URL should end with /zaken/api/v1/',
      description:
        'The API supports the storage and disclosure of data on all municipal matters to other applications, of all types.',
      'link-document-to-zaak': 'Link document to zaak',
      'link-uploaded-document-to-zaak': 'Link uploaded document to zaak',
      linkUploadedDocumentToZaakMessage:
        'Linking an uploaded document to a zaak requires no configuration.',
      configurationTitle: 'Configuration name',
      configurationTitleTooltip:
        'With this name the plugin will be recognizable in the rest of the application',
      documentUrl: 'URL to the document',
      documentUrlTooltip:
        'This field supports URLs and process variables. Use pv:variable to read a process variable',
      titel: 'Document title',
      titelTooltip:
        '(Optional) Fills the title field in the metadata of the link between the Zaak and the Document',
      beschrijving: 'Document description',
      beschrijvingTooltip:
        '(Optional) Fills the description field in the metadata of the link between the Zaak and the Document',
      authenticationPluginConfiguration: 'Authentication plugin configuration',
      authenticationPluginConfigurationTooltip:
        'Select the plugin that can handle the authentication. If the selection box remains empty, the authentication plugin (e.g. OpenZaak) will have to be created first',
      linkDocumentInformation:
        'This action links a document from the Documents API to the zaak associated with the case.',
      'create-zaak': 'Create zaak',
      createZaakInformation:
        'This action creates a zaak in the Zaken API and links the new zaak with the case.',
      rsin: 'RSIN',
      rsinTooltip: 'Legal Entities and Partnerships Information Number',
      zaakType: 'Zaaktype',
      zaakTypeTooltip: 'In this field the reference must be made to the type of the zaak.',
      inputTypeZaakTypeToggle: 'Input type Zaaktype-URL',
      text: 'Text',
      selection: 'Selection',
      'create-natuurlijk-persoon-zaak-rol': 'Create Zaakrol - natural person',
      roltypeUrl: 'Role type URL',
      rolToelichting: 'Role explanation',
      inpBsn: 'Initiator BSN',
      anpIdentificatie: 'Other natural person identification',
      inpA_nummer: 'Administration number person',
      roltypeUrlTooltip: 'URL to a role type within the Zaaktype of a Zaak',
      rolToelichtingTooltip: 'Description of the nature of the role',
      inpBsnTooltip: "The initiator's social security number",
      anpIdentificatieTooltip:
        'The unique number issued by the municipality for another natural person',
      inpA_nummerTooltip: 'The administration number of the person, as referred to in the Wet BRP',
    },
    de: {
      title: 'Zaken API',
      url: 'URL',
      urlTooltip:
        'Dieses Feld muss die URL zur rest API von Open Zaak enthalten, daher sollte diese URL mit enden /zaken/api/v1/',
      description:
        'Die API unterstützt die Speicherung und Weitergabe von Daten zu allen kommunalen Belangen an andere Anwendungen.',
      'link-document-to-zaak': 'Dokument mit Zaak verknüpfen',
      'link-uploaded-document-to-zaak': 'Hochgeladenes Dokument mit Zaak verknüpfen',
      linkUploadedDocumentToZaakMessage:
        'Das Verknüpfen eines hochgeladenen Dokuments mit einem Zaak erfordert keine Konfiguration.',
      configurationTitle: 'Konfigurationsname',
      configurationTitleTooltip:
        'An diesem Namen wird das Plugin im Rest der Anwendung erkennbar sein',
      documentUrl: 'URL zum Dokument',
      documentUrlTooltip:
        'Dieses Feld unterstützt URLs und Prozessvariablen. Verwenden Sie pv:Variablen, um eine Prozessvariable zu lesen',
      titel: 'Dokumenttitel',
      titelTooltip:
        '(Optional) Füllt das Titelfeld in den Metadaten des Links zwischen dem Zaak und dem Dokument aus',
      beschrijving: 'Dokumentbeschreibung',
      beschrijvingTooltip:
        '(Optional) Füllt das Beschreibungsfeld in den Metadaten des Links zwischen dem Zaak und dem Dokument aus',
      authenticationPluginConfiguration: 'Authentifizierungs-Plugin-Konfiguration',
      authenticationPluginConfigurationTooltip:
        'Wählen Sie das Plugin aus, das die Authentifizierung verarbeiten kann. Bleibt das Auswahlfeld leer, muss zunächst das Authentifizierungs-Plugin (z. B. OpenZaak) erstellt werden',
      linkDocumentInformation:
        'Diese Aktion verknüpft ein Dokument aus der Dokumenten-API mit dem mit dem Fall verknüpften Zaak.',
      'create-zaak': 'Zaak erschaffen',
      createZaakInformation:
        'Diese Aktion hat einen zaak in der Zaken-API definiert und den neuen zaak mit dem Fall verknüpft.',
      rsin: 'RSIN',
      rsinTooltip: 'Informationsnummer für juristische Personen und Partnerschaften.',
      zaakType: 'Zaaktype',
      zaakTypeTooltip: 'In diesem Feld muss auf die zaaktype verwiesen werden.',
      inputTypeZaakTypeToggle: 'Eingabetyp Zaaktype-URL',
      text: 'Text',
      selection: 'Auswahl',
      'create-natuurlijk-persoon-zaak-rol': 'Zaakrol erstellen – natürliche Person',
      roltypeUrl: 'Rollentyp-URL',
      rolToelichting: 'Rollenerklärung',
      inpBsn: 'Initiator BSN',
      anpIdentificatie: 'Andere Identifizierung natürlicher Personen',
      inpA_nummer: 'Verwaltungsnummer Person',
      roltypeUrlTooltip: 'URL zu einem Rollentyp innerhalb des Zaaktypes eines Zaaks',
      rolToelichtingTooltip: 'Beschreibung der Art der Rolle',
      inpBsnTooltip: 'Die Sozialversicherungsnummer des Initiators',
      anpIdentificatieTooltip:
        'Die eindeutige Nummer, die von der Gemeinde für eine andere natürliche Person vergeben wird',
      inpA_nummerTooltip: 'Die Verwaltungsnummer der Person im Sinne des Wet BRP',
    },
  },
};

export {zakenApiPluginSpecification};
