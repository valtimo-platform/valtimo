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
import {DocumentenApiWopiConfigurationComponent} from './components/documenten-api-wopi-configuration/documenten-api-wopi-configuration.component';
import {DOCUMENTEN_API_WOPI_PLUGIN_LOGO_BASE64} from './assets';

const documentenApiWopiPluginSpecification: PluginSpecification = {
  pluginId: 'documentenapiwopi',
  pluginConfigurationComponent: DocumentenApiWopiConfigurationComponent,
  pluginLogoBase64: DOCUMENTEN_API_WOPI_PLUGIN_LOGO_BASE64,
  pluginTranslations: {
    nl: {
      title: 'Documenten API WOPI',
      description:
        'Plugin waarmee het mogelijk maakt om documenten in te zien en te bewerken via het WOPI protocol.',
      configurationTitle: 'Configuratienaam',
      configurationTitleTooltip:
        'Hier kun je een eigen naam verzinnen. Onder deze naam zal de plugin te herkennen zijn in de rest van de applicatie',
      wopiClientDiscoveryUrl: 'WOPI Client Discovery URL',
      wopiClientDiscoveryUrlTooltip:
        'In dit veld moet de URL komen die verwijst naar de discovery pagina van de WOPI client (afhankelijk van de client eindigt deze meestal op "/hosting/discovery").',
      documentenApiPluginConfiguration: 'Documenten API configuratie',
      documentenApiPluginConfigurationTooltip:
        'Selecteer de plugin die gebruikt wordt voor het ontsluiten van documenten. Deze plugin zal worden gebruikt om de originele documenten te ontsluiten zodat deze geopend kunnen worden in de browser.',
    },
    en: {
      title: 'Documenten API WOPI',
      description: 'Plugin to allow viewing, editing and collaborating on documents directly from GZAC.',
      configurationTitle: 'Configuration name',
      configurationTitleTooltip:
        'Here you can enter a name for the plugin. This name will be used to recognize the plugin throughout the rest of the application',
      wopiClientDiscoveryUrl: 'WOPI Client Discovery URL',
      wopiClientDiscoveryUrlTooltip:
        'This field must contain the URL that points to the discovery page of the WOPI client (depending on the client, this usually ends with "/hosting/discovery").',
      documentenApiPluginConfiguration: 'Document API configuration',
      documentenApiPluginConfigurationTooltip:
        'Select the plugin that can access the documents. This plugin will be used to access the original documents so they can be opened in the browser.',
    },
  },
};

export {documentenApiWopiPluginSpecification};
