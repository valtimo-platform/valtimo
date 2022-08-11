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
import {ZAKEN_API_PLUGIN_LOGO_BASE64} from './assets';
import {LinkDocumentToZaakConfigurationComponent} from './components/link-document-to-zaak/link-document-to-zaak-configuration.component';
import {ZakenApiConfigurationComponent} from './components/zaken-api-configuration/zaken-api-configuration.component';

const zakenApiPluginSpecification: PluginSpecification = {
  pluginId: 'zakenapi',
  /*
  A component of the interface PluginConfigurationComponent, used to configure the plugin itself.
   */
  pluginConfigurationComponent: ZakenApiConfigurationComponent,
  pluginLogoBase64: ZAKEN_API_PLUGIN_LOGO_BASE64,
  functionConfigurationComponents: {
    'link-document-to-zaak': LinkDocumentToZaakConfigurationComponent,
  },

  pluginTranslations: {
    nl: {
      title: 'Zaken API',
      url: 'URL',
      description:
        'De API ondersteunt het opslaan en het naar andere applicaties ontsluiten van gegevens over alle gemeentelijke zaken, van elk type.',
      'link-document-to-zaak': 'Koppel document aan zaak',
      configurationTitle: 'Configuratienaam',
      documentUrl: 'URL naar het document',
      titel: 'Documenttitel',
      beschrijving: 'Documentbeschrijving',
      authenticationPluginConfiguration: 'Configuratie authenticatie-plug-in',
      linkDocumentInformation:
        'Deze actie koppelt een document uit de Documenten API aan de zaak die bij het dossier hoort.',
      documentUrlTooltip:
        'Dit veld ondersteunt URLs en proces variabelen. Gebruik pv:variable om een proces variabele uit te lezen',
    },
    en: {
      title: 'Zaken API',
      url: 'URL',
      description:
        'The API supports the storage and disclosure of data on all municipal matters to other applications, of all types.',
      'link-document-to-zaak': 'Link document to zaak',
      configurationTitle: 'Configuration name',
      documentUrl: 'URL to the document',
      titel: 'Document title',
      beschrijving: 'Document description',
      authenticationPluginConfiguration: 'Authentication plugin configuration',
      linkDocumentInformation:
        'This action links a document from the Documents API to the zaak associated with the case.',
      documentUrlTooltip:
        'This field supports URLs and process variables. Use pv:variable to read a process variable',
    },
    de: {
      title: 'Zaken API',
      url: 'URL',
      description:
        'Die API unterstützt die Speicherung und Weitergabe von Daten zu allen kommunalen Belangen an andere Anwendungen.',
      'link-document-to-zaak': 'Dokument mit Zaak verknüpfen',
      configurationTitle: 'Konfigurationsname',
      documentUrl: 'URL zum Dokument',
      titel: 'Dokumenttitel',
      beschrijving: 'Dokumentbeschreibung',
      authenticationPluginConfiguration: 'Authentifizierungs-Plugin-Konfiguration',
      linkDocumentInformation:
        'Diese Aktion verknüpft ein Dokument aus der Dokumenten-API mit dem mit dem Fall verknüpften Zaak.',
      documentUrlTooltip:
        'Dieses Feld unterstützt URLs und Prozessvariablen. Verwenden Sie pv:Variablen, um eine Prozessvariable zu lesen',
    },
  },
};

export {zakenApiPluginSpecification};
