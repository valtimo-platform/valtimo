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
import {ObjecttypenApiConfigurationComponent} from './components/objecttypen-api-configuration/objecttypen-api-configuration.component';
import {OBJECTTYPEN_API_PLUGIN_LOGO_BASE64} from './assets';

const objecttypenApiPluginSpecification: PluginSpecification = {
  pluginId: 'objecttypenapi',
  pluginConfigurationComponent: ObjecttypenApiConfigurationComponent,
  pluginLogoBase64: OBJECTTYPEN_API_PLUGIN_LOGO_BASE64,

  pluginTranslations: {
    nl: {
      title: 'Objecttypen API',
      url: 'Objecttypen API URL',
      urlTooltip: 'In dit veld moet de verwijzing komen naar de REST API van Objecttypen',
      description:
        'Met de Overige Objecten Registratie API-specificaties (Objecttypen) kunnen gemeenten eenduidig objecten registreren, opslaan en ontsluiten.',
      configurationTitle: 'Configuratienaam',
      configurationTitleTooltip:
        'Onder deze naam zal de plugin te herkennen zijn in de rest van de applicatie',
      authenticationPluginConfiguration: 'Configuratie authenticatie-plug-in',
    },
    en: {
      title: 'Objecttypen API',
      url: 'Objecttypen API URL',
      urlTooltip: 'This field must contain the URL to the REST API of Objecttypen',
      description:
        'With the Other Objects Registration API specifications (Object types), municipalities can unambiguously register, store and access objects.',
      configurationTitle: 'Configuration name',
      configurationTitleTooltip:
        'With this name the plugin will be recognizable in the rest of the application',
      authenticationPluginConfiguration: 'Authentication plugin configuration',
    },
    de: {
      title: 'Objecttypen API',
      url: 'Objecttypen API URL',
      urlTooltip: 'Dieses Feld muss die URL zur REST API von Objecttypen enthalten',
      description:
        'Mit den Spezifikationen der Other Objects Registration API (Objekttypen) können Kommunen Objekte eindeutig registrieren, speichern und darauf zugreifen.',
      configurationTitle: 'Konfigurationsname',
      configurationTitleTooltip:
        'An diesem Namen wird das Plugin im Rest der Anwendung erkennbar sein',
      authenticationPluginConfiguration: 'Authentifizierungs-Plugin-Konfiguration',
    },
  },
};

export {objecttypenApiPluginSpecification};
