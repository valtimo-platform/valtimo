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
import {CatalogiApiConfigurationComponent} from './components/catalogi-api-configuration/catalogi-api-configuration.component';
import {CATALOGI_API_PLUGIN_LOGO_BASE64} from './assets';

const catalogiApiPluginSpecification: PluginSpecification = {
  pluginId: 'catalogiapi',
  pluginConfigurationComponent: CatalogiApiConfigurationComponent,
  pluginLogoBase64: CATALOGI_API_PLUGIN_LOGO_BASE64,
  pluginTranslations: {
    nl: {
      title: 'Catalogi API',
      url: 'Catalogi API URL',
      urlTooltip: 'Een URL naar de REST API van Catalogi',
      description:
        'API voor opslag en ontsluiting van zaaktype-catalogi, zaaktypen en onderliggende typen.',
      configurationTitle: 'Configuratienaam',
      configurationTitleTooltip:
        'De naam van de huidige plugin-configuratie. Onder deze naam kan de configuratie in de rest van de applicatie teruggevonden worden.',
      authenticationPluginConfiguration: 'Configuratie authenticatie-plug-in',
    },
    en: {
      title: 'Catalogi API',
      url: 'Catalogi API URL',
      urlTooltip: 'A URL to the REST API of Catalogi',
      description:
        'API for storage and retrieval of zaaktype catalogs, zaaktypes and child types.',
      configurationTitle: 'Configuration name',
      configurationTitleTooltip:
        'The name of the current plugin configuration. Under this name, the configuration can be found in the rest of the application.',
      authenticationPluginConfiguration: 'Authentication plugin configuration',
    },
    de: {
      title: 'Catalogi API',
      url: 'Catalogi API URL',
      urlTooltip: 'Die URL zur REST API von Catalogi',
      description:
        'API zum Speichern und Abrufen von Falltypkatalogen, Falltypen und untergeordneten Typen.',
      configurationTitle: 'Konfigurationsname',
      configurationTitleTooltip:
        'Der Name der aktuellen Plugin-Konfiguration. Unter diesem Namen ist die Konfiguration im Rest der Anwendung zu finden.',
      authenticationPluginConfiguration: 'Authentifizierungs-Plugin-Konfiguration',
    },
  },
};

export {catalogiApiPluginSpecification};
