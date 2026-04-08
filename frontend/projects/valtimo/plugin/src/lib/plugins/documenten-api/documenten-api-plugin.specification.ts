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
import {StoreTempDocumentConfigurationComponent} from './components/store-temp-document/store-temp-document-configuration.component';
import {DOCUMENTEN_API_PLUGIN_LOGO_BASE64} from './assets';
import {DocumentenApiConfigurationComponent} from './components/documenten-api-configuration/documenten-api-configuration.component';
import {StoreUploadedDocumentConfigurationComponent} from './components/store-uploaded-document/store-uploaded-document-configuration.component';
import {DownloadDocumentConfigurationComponent} from './components/download-document/download-document-configuration.component';
import {StoreUploadedDocumentInPartsConfigurationComponent} from './components/store-uploaded-document-in-parts/store-uploaded-document-in-parts-configuration.component';
import {LinkDocumentToObjectConfigurationComponent} from './components/link-document-to-object/link-document-to-object-configuration.component';
import {DeleteDocumentLinkConfigurationComponent} from './components/delete-document-link/delete-document-link-configuration.component';
import {documentenApiActionFilterFunction} from './services';

const documentenApiPluginSpecification: PluginSpecification = {
  pluginId: 'documentenapi',
  pluginConfigurationComponent: DocumentenApiConfigurationComponent,
  pluginLogoBase64: DOCUMENTEN_API_PLUGIN_LOGO_BASE64,
  functionConfigurationComponents: {
    'store-temp-document': StoreTempDocumentConfigurationComponent,
    'store-uploaded-document': StoreUploadedDocumentConfigurationComponent,
    'store-uploaded-document-in-parts': StoreUploadedDocumentInPartsConfigurationComponent,
    'download-document': DownloadDocumentConfigurationComponent,
    'link-document-to-object': LinkDocumentToObjectConfigurationComponent,
    'delete-document-link': DeleteDocumentLinkConfigurationComponent,
  },
  functionConfigurationComponentsFilter: documentenApiActionFilterFunction,
  pluginTranslations: {
    nl: {
      title: 'Documenten API',
      description: 'API voor opslag en ontsluiting van documenten en daarbij behorende metadata.',
      'store-temp-document': 'Document opslaan',
      'store-uploaded-document': 'Geupload document opslaan',
      'store-uploaded-document-in-parts': 'Geupload document opslaan in bestandsdelen',
      'download-document': 'Download document',
      'link-document-to-object': 'Document koppelen aan object',
      'delete-document-link': 'Documentkoppeling verwijderen',
      storeUploadedDocumentMessage:
        'Het opslaan van een geupload document heeft geen configuratie nodig.',
      storeUploadedDocumentInPartsMessage:
        'Het opslaan van een geupload document in bestandsdelen heeft geen configuratie nodig',
      configurationTitle: 'Configuratienaam',
      configurationTitleTooltip:
        'Hier kunt je een eigen naam verzinnen. Onder deze naam zal de plugin te herkennen zijn in de rest van de applicatie',
      url: 'Documenten API URL',
      urlTooltip:
        'In dit veld moet de verwijzing komen naar de REST API van Documenten. Deze url moet dus eindigen op /documenten/api/v1/',
      bronorganisatie: 'Bronorganisatie RSIN',
      bronorganisatieTooltip:
        'Vul hier het RSIN van de organisatie in die verantwoordelijk is voor de documenten',
      fileName: 'Bestandsnaam',
      fileNameTooltip:
        'De naam van het fysieke bestand waarin de inhoud van het document is vastgelegd, inclusief extensie',
      confidentialityLevel: 'Vertrouwelijkheidsaanduiding',
      confidentialityLevelTooltip:
        'Aanduiding van de mate waarin het document voor de openbaarheid bestemd is',
      inputTitle: 'Titel',
      inputTitleTooltip: 'De naam waaronder het document formeel bekend is',
      inputDescription: 'Beschrijving',
      inputDescriptionTooltip: 'Een generieke beschrijving van de inhoud van het document',
      openbaar: 'Openbaar',
      beperkt_openbaar: 'Beperkt openbaar',
      intern: 'Intern',
      zaakvertrouwelijk: 'Zaakvertrouwelijk',
      vertrouwelijk: 'Vertrouwelijk',
      confidentieel: 'Confidentieel',
      geheim: 'Geheim',
      zeer_geheim: 'Zeer geheim',
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
      apiVersion: 'Documenten API versie',
      apiVersionTooltip: 'Selecteer de versie van de Documenten API',
      downloadDocumentMessage:
        'Het downloaden van een document vanuit de Documenten API vereist geen configuratie.',
      processVariableName:
        'Wat is de naam van de procesvariabele waarnaar u het document wilt downloaden?',
      linkDocumentToObjectMessage:
        "Koppelt het document waarvan de URL is opgeslagen in de procesvariabele 'documentUrl' aan een object. " +
        "Procesvariabelen kunnen worden gebruikt met de notatie 'pv:variabelenaam'.",
      linkDocumentToObjectExperimentalWarning:
        '⚠ Experimentele functie: deze actie maakt gebruik van de objectinformatieobjecten-API.',
      deleteDocumentLinkMessage:
        "Verwijdert een objectinformatieobject-koppeling op basis van de opgegeven URL. " +
        "De koppelingsactie 'Document koppelen aan object' slaat deze URL op in de procesvariabele 'objectInformatieObjectUrl'. " +
        "Procesvariabelen kunnen worden gebruikt met de notatie 'pv:variabelenaam'.",
      deleteDocumentLinkExperimentalWarning:
        '⚠ Experimentele functie: deze actie maakt gebruik van de objectinformatieobjecten-API.',
      objectUrl: 'Object URL',
      objectUrlTooltip:
        "De URL van het object waaraan het document gekoppeld moet worden. " +
        "Gebruik 'pv:variabelenaam' om een procesvariabele te refereren, bijv. 'pv:objectUrl'.",
      objectType: 'Objecttype',
      objectTypeTooltip:
        "Het type van het object, bijv. 'zaak', 'besluit' of 'apiname'. " +
        "Gebruik 'pv:variabelenaam' om een procesvariabele te refereren.",
      objectInformatieObjectUrl: 'Objectinformatieobject URL',
      objectInformatieObjectUrlTooltip:
        "De URL van de objectinformatieobject-koppeling die verwijderd moet worden. ",
    },
    en: {
      title: 'Documenten API',
      description: 'API for storing and accessing documents and associated metadata.',
      'store-temp-document': 'Save document',
      'store-uploaded-document': 'Save uploaded document',
      'store-uploaded-document-in-parts': 'Save uploaded document in parts',
      'download-document': 'Download document',
      'link-document-to-object': 'Link document to object',
      'delete-document-link': 'Delete document link',
      storeUploadedDocumentMessage:
        'Saving an uploaded document does not require any configuration.',
      storeUploadedDocumentInPartsMessage:
        'Saving an uploaded document in parts does not require any configuration.',
      configurationTitle: 'Configuration name',
      configurationTitleTooltip:
        'Here you can enter a name for the plugin. This name will be used to recognize the plugin throughout the rest of the application',
      url: 'Documenten API URL',
      urlTooltip:
        'This field must contain the URL to the REST API of Documenten, therefore this URL should end with /documenten/api/v1/',
      bronorganisatie: 'Organisation RSIN',
      bronorganisatieTooltip:
        'Enter here the RSIN of the organization responsible for the documents. The RSIN is a dutch identification number for legal entities and partnerships ',
      fileName: 'File name',
      fileNameTooltip:
        'The name of the physical file in which the content of the document is captured, including extension',
      confidentialityLevel: 'Confidentiality level',
      confidentialityLevelTooltip:
        'Indication of the extent to which the document is intended for public access',
      inputTitle: 'Title',
      inputTitleTooltip: 'The name by which the document is formally known',
      inputDescription: 'Description',
      inputDescriptionTooltip: 'A generic description of the content of the document',
      openbaar: 'Public',
      beperkt_openbaar: 'Restricted public',
      intern: 'Internal',
      zaakvertrouwelijk: 'Case confidential',
      vertrouwelijk: 'Private',
      confidentieel: 'Confidential',
      geheim: 'Secret',
      zeer_geheim: 'Very secret',
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
      apiVersion: 'Documenten API version',
      apiVersionTooltip: 'Select the version of the Documenten API',
      downloadDocumentMessage:
        'Downloading a document form the Documenten API does not require any configuration.',
      processVariableName:
        'What is the name of the process variable you want to download the document to?',
      linkDocumentToObjectMessage:
        "Links the document whose URL is stored in the process variable 'documentUrl' to an object. For Zaak items use the Zaken API to ensure backwards compatibility." +
        "Process variables can be referenced using the notation 'pv:variableName'.",
      linkDocumentToObjectExperimentalWarning:
        '⚠ Experimental feature: this action uses the objectinformatieobjecten API.',
      deleteDocumentLinkMessage:
        "Deletes an objectinformatieobject link by its URL. " +
        "The 'Link document to object' action stores this URL in the process variable 'objectInformatieObjectUrl'. " +
        "Process variables can be referenced using the notation 'pv:variableName'.",
      deleteDocumentLinkExperimentalWarning:
        '⚠ Experimental feature: this action uses the objectinformatieobjecten API.',
      objectUrl: 'Object URL',
      objectUrlTooltip:
        "The URL of the object to link the document to. " +
        "Use 'pv:variableName' to reference a process variable, e.g. 'pv:objectUrl'.",
      objectType: 'Object type',
      objectTypeTooltip:
        "The type of the object, e.g. 'zaak', 'besluit' or 'apiname'. " +
        "Use 'pv:variableName' to reference a process variable.",
      objectInformatieObjectUrl: 'Objectinformatieobject URL',
      objectInformatieObjectUrlTooltip:
        "The URL of the objectinformatieobject link to delete. " +
        "The preceding action stores this in the process variable 'objectInformatieObjectUrl'.",
    },
  },
};

export {documentenApiPluginSpecification};
