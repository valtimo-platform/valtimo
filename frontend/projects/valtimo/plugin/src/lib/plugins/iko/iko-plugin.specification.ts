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
import {IkoConfigurationComponent} from './components/iko-configuration/iko-configuration.component';
import {IKO_PLUGIN_LOGO_BASE64} from './assets';

const ikoPluginSpecification: PluginSpecification = {
  pluginId: 'iko',
  pluginConfigurationComponent: IkoConfigurationComponent,
  pluginLogoBase64: IKO_PLUGIN_LOGO_BASE64,
  functionConfigurationComponents: {},
  pluginTranslations: {
    nl: {
      title: 'IKO',
      url: 'IKO URL',
      urlTooltip: 'Een URL naar de REST API van IKO',
      description: 'Integraal Klant & Objectbeeld.',
      configurationTitle: 'Configuratienaam',
      configurationTitleTooltip:
        'De naam van de huidige plugin-configuratie. Onder deze naam kan de configuratie in de rest van de applicatie teruggevonden worden.',
    },
    en: {
      title: 'IKO',
      url: 'IKO URL',
      urlTooltip: 'A URL to the REST API of IKO',
      description: 'Integraal Klant & Objectbeeld.',
      configurationTitle: 'Configuration name',
      configurationTitleTooltip:
        'The name of the current plugin configuration. Under this name, the configuration can be found in the rest of the application.',
    },
    de: {
      title: 'IKO',
      url: 'IKO URL',
      urlTooltip: 'Die URL zur REST API von IKO',
      description: 'Integraal Klant & Objectbeeld.',
      configurationTitle: 'Konfigurationsname',
      configurationTitleTooltip:
        'Der Name der aktuellen Plugin-Konfiguration. Unter diesem Namen ist die Konfiguration im Rest der Anwendung zu finden.',
    },
  },
};

export {ikoPluginSpecification};
