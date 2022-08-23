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

import {PluginSpecification} from '../../models';
import {StoreTempDocumentConfigurationComponent} from './components/store-temp-document/store-temp-document-configuration.component';
import {DOCUMENTEN_API_PLUGIN_LOGO_BASE64} from './assets';
import {DocumentenApiConfigurationComponent} from './components/documenten-api-configuration/documenten-api-configuration.component';

const documentenApiPluginSpecification: PluginSpecification = {
  pluginId: 'documentenapi',
  pluginConfigurationComponent: DocumentenApiConfigurationComponent,
  pluginLogoBase64: DOCUMENTEN_API_PLUGIN_LOGO_BASE64,
  functionConfigurationComponents: {
    'store-temp-document': StoreTempDocumentConfigurationComponent,
  },
  pluginTranslations: {
    nl: {
      title: 'Documenten API',
      description: 'API voor opslag en ontsluiting van documenten en daarbij behorende metadata.',
      'store-temp-document': 'Document opslaan',
      configurationTitle: 'Configuratienaam',
      configurationTitleTooltip:
        'Hier kunt u een eigen naam verzinnen. Onder deze naam zal de plugin te herkennen zijn in de rest van de applicatie',
      url: 'Documenten API URL',
      urlTooltip:
        'In dit veld moet de verwijzing komen naar de REST API van Documenten. Deze url moet dus eindigen op /documenten/api/v1/',
      bronorganisatie: 'Bronorganisatie RSIN',
      bronorganisatieTooltip:
        'Vul hier het RSIN van de organisatie in die verantwoordelijk is voor de documenten',
      localDocumentLocation: 'Naam procesvariabele met document',
      localDocumentLocationTooltip:
        'Hier moet de procesvariabele ingevuld worden die wijst naar de locatie waar het document lokaal staat opgeslagen',
      storedDocumentUrl: 'Naam procesvariabele voor opslag document-URL',
      storeDocumentUrlTooltip:
        'Nadat het document geupload is naar de Documenten API zal de applicatie in deze procesvariabele de URL naar het document opslaan.',
      taal: 'Taal',
      status: 'Status',
      informatieobjecttype: 'URL naar het informatieobjecttype',
      informatieobjecttypeTooltip:
        'Vul in dit veld de volledige URL naar een informatieobjecttype van een Zaak catalogus. Deze URL moet dus eindigen op /catalogi/api/v1/informatieobjecttypen/{uuid}',
      nld: 'Nederlands',
      in_bewerking: 'In bewerking',
      ter_vaststelling: 'Ter vaststelling',
      definitief: 'Definitief',
      gearchiveerd: 'Gearchiveerd',
      authenticationPluginConfiguration: 'Configuratie authenticatie-plug-in',
      authenticationPluginConfigurationTooltip:
        'Selecteer de plugin die de authenticatie kan afhandelen. Wanneer de selectiebox leeg blijft zal de authenticatie plugin (bv. OpenZaak) eerst aangemaakt moeten worden',
    },
    en: {
      title: 'Documenten API',
      description: 'API for storing and accessing documents and associated metadata.',
      'store-temp-document': 'Save document',
      configurationTitle: 'Configuration name',
      configurationTitleTooltip:
        'Here you can enter a name for the plugin. This name will be used to recognize the plugin throughout the rest of the application',
      url: 'Documenten API URL',
      urlTooltip:
        'This field must contain the URL to the rest API of Documenten, therefore this URL should end with /documenten/api/v1/',
      bronorganisatie: 'Organisation RSIN',
      bronorganisatieTooltip:
        'Enter here the RSIN of the organization responsible for the documents. The RSIN is a dutch identification number for legal entities and partnerships ',
      localDocumentLocation: 'Name of process variable with document',
      localDocumentLocationTooltip:
        'Enter the process variable that points to the location where the document is stored locally',
      storedDocumentUrl: 'Process variable name for storing document URL',
      storeDocumentUrlTooltip:
        'After the document has been uploaded to the Documenten API, the application will store the URL to the document in this process variable.',
      taal: 'Language',
      status: 'Status',
      informatieobjecttype: 'URL to the informationobjecttype',
      informatieobjecttypeTooltip:
        'Enter the full URL to an information object type of a Zaak catalog in this field. So this URL must end with /catalogi/api/v1/informatieobjecttypen/{uuid}',
      nld: 'Dutch',
      in_bewerking: 'Editing',
      ter_vaststelling: 'To be confirmed',
      definitief: 'Final',
      gearchiveerd: 'Archived',
      authenticationPluginConfiguration: 'Authentication plugin configuration',
      authenticationPluginConfigurationTooltip:
        'Select the plugin that can handle the authentication. If the selection box remains empty, the authentication plugin (e.g. OpenZaak) will have to be created first',
    },
    de: {
      title: 'Documenten API',
      description: 'API zum Speichern und Zugreifen auf Dokumente und zugehörige Metadaten.',
      'store-temp-document': 'Dokument speichern',
      configurationTitle: 'Konfigurationsname',
      configurationTitleTooltip:
        'Hier können Sie einen Namen für das Plugin eingeben. Dieser Name wird verwendet, um das Plugin im Rest der Anwendung zu erkennen',
      url: 'Documenten API URL',
      urlTooltip:
        'Dieses Feld muss die URL zur rest API von Documenten enthalten, daher sollte diese URL mit enden /documenten/api/v1/',
      bronorganisatie: 'Organisation RSIN',
      bronorganisatieTooltip:
        'Geben Sie hier den RAIN der für die Dokumente verantwortlichen Organisation ein. Der RAIN ist eine niederländische Identifikationsnummer für juristische Personen und Personengesellschaften',
      localDocumentLocation: 'Name Prozessvariable mit Dokument',
      localDocumentLocationTooltip:
        'Geben Sie die Prozessvariable ein, die auf den Ort zeigt, an dem das Dokument lokal gespeichert ist',
      storedDocumentUrl: 'Name der Prozessvariablen zum Speichern der Dokument-URL',
      storeDocumentUrlTooltip:
        'Nachdem das Dokument in die Dokumenten-API hochgeladen wurde, speichert die Anwendung die URL zum Dokument in dieser Prozessvariablen.',
      taal: 'Sprache',
      status: 'Status',
      informatieobjecttype: 'URL zum Informationsobjekttyp',
      informatieobjecttypeTooltip:
        'Geben Sie in diesem Feld die vollständige URL zu einem Informationsobjekttyp eines Case Katalogs. Diese URL muss daher mit enden /catalogi/api/v1/informatieobjecttypen/{uuid}',
      nld: 'Niederländisch',
      in_bewerking: 'In Bearbeitung',
      ter_vaststelling: 'Zu bestimmen',
      definitief: 'Endgültig',
      gearchiveerd: 'Archiviert',
      authenticationPluginConfiguration: 'Authentifizierungs-Plugin-Konfiguration',
      authenticationPluginConfigurationTooltip:
        'Wählen Sie das Plugin aus, das die Authentifizierung verarbeiten kann. Bleibt das Auswahlfeld leer, muss zunächst das Authentifizierungs-Plugin (z. B. OpenZaak) erstellt werden',
    },
  },
};

export {documentenApiPluginSpecification};
