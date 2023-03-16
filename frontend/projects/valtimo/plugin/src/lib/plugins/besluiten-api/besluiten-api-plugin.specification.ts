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
import {BesluitenApiConfigurationComponent} from './components/besluiten-api-configuration/besluiten-api-configuration.component';
import {BESLUITEN_API_PLUGIN_LOGO_BASE64} from './assets';

const besluitenApiPluginSpecification: PluginSpecification = {
  pluginId: 'besluitenapi',
  pluginConfigurationComponent: BesluitenApiConfigurationComponent,
  pluginLogoBase64: BESLUITEN_API_PLUGIN_LOGO_BASE64,
  pluginTranslations: {
    nl: {
      title: 'Besluiten API',
      rsin: 'RSIN',
      rsinTooltip: 'Rechtspersonen en Samenwerkingsverbanden Informatienummer',
      url: 'Besluiten API URL',
      urlTooltip: 'Een URL naar de REST API van Besluiten',
      description:
        'API voor opslag en ontsluiting van besluiten en daarbij behorende metadata.',
      configurationTitle: 'Configuratienaam',
      configurationTitleTooltip:
        'De naam van de huidige plugin-configuratie. Onder deze naam kan de configuratie in de rest van de applicatie teruggevonden worden.',
      authenticationPluginConfiguration: 'Configuratie authenticatie-plug-in',
    },
    en: {
      title: 'Besluiten API',
      rsin: 'RSIN',
      rsinTooltip: 'Legal Entities and Partnerships Information Number',
      url: 'Besluiten API URL',
      urlTooltip: 'A URL to the REST API of Besluiten',
      description:
        'API for storage and access to decisions and associated metadata.',
      configurationTitle: 'Configuration name',
      configurationTitleTooltip:
        'The name of the current plugin configuration. Under this name, the configuration can be found in the rest of the application.',
      authenticationPluginConfiguration: 'Authentication plugin configuration',
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
    },
  },
};

export {besluitenApiPluginSpecification};
