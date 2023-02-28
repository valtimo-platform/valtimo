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
import {ObjectenApiConfigurationComponent} from './components/objecten-api-configuration/objecten-api-configuration.component';
import {OBJECTEN_API_PLUGIN_LOGO_BASE64} from './assets';

const objectenApiPluginSpecification: PluginSpecification = {
  pluginId: 'objectenapi',
  pluginConfigurationComponent: ObjectenApiConfigurationComponent,
  pluginLogoBase64: OBJECTEN_API_PLUGIN_LOGO_BASE64,

  pluginTranslations: {
    nl: {
      title: 'Objecten API',
      url: 'Objecten API URL',
      urlTooltip: 'Een URL naar de REST API van Objecten',
      description:
        'Met de Overige Objecten Registratie API-specificaties (Objecten) kunnen gemeenten eenduidig objecten registreren, opslaan en ontsluiten.',
      configurationTitle: 'Configuratienaam',
      configurationTitleTooltip:
        'Onder deze naam zal de plug-in te herkennen zijn in de rest van de applicatie',
      authenticationPluginConfiguration: 'Configuratie authenticatie-plug-in',
    },
    en: {
      title: 'Objects API',
      url: 'Objects API URL',
      urlTooltip: 'A URL to the REST API of Objects',
      description:
        'With the Other Objects Registration API specifications (Objects), municipalities can unambiguously register, store and access objects.',
      configurationTitle: 'Configuration name',
      configurationTitleTooltip:
        'With this name the plugin will be recognizable in the rest of the application',
      authenticationPluginConfiguration: 'Authentication plugin configuration',
    },
    de: {
      title: 'Objecten API',
      url: 'Objecten API URL',
      urlTooltip: 'Die URL zur REST API von Objecten',
      description:
        'Mit den Spezifikationen der Other Objects Registration API (Objecten) können Kommunen Objecten eindeutig registrieren, speichern und darauf zugreifen.',
      configurationTitle: 'Konfigurationsname',
      configurationTitleTooltip:
        'An diesem Namen wird das Plugin im Rest der Anwendung erkennbar sein',
      authenticationPluginConfiguration: 'Authentifizierungs-Plugin-Konfiguration',
    },
  },
};

export {objectenApiPluginSpecification};
