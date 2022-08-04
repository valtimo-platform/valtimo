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
import {OpenZaakConfigurationComponent} from './components/open-zaak-configuration/open-zaak-configuration.component';
import {OPEN_ZAAK_PLUGIN_LOGO_BASE64} from './assets';

const openZaakPluginSpecification: PluginSpecification = {
  pluginId: 'openzaak',
  pluginConfigurationComponent: OpenZaakConfigurationComponent,
  pluginLogoBase64: OPEN_ZAAK_PLUGIN_LOGO_BASE64,
  pluginTranslations: {
    nl: {
      title: 'OpenZaak',
      description:
        'OpenZaak is een productiewaardig API platform die de API-standaard voor zaakgericht werken implementeert (de ZGW-API’s).',
      configurationTitle: 'Configuratienaam',
      clientId: 'Client ID',
      clientSecret: 'Secret',
    },
    en: {
      title: 'OpenZaak',
      description:
        'OpenZaak is a production-worthy API platform that implements the API standard for case-oriented working (the ZGW APIs).',
      configurationTitle: 'Configuration name',
      clientId: 'Client ID',
      clientSecret: 'Secret',
    },
    de: {
      title: 'OpenZaak',
      description:
        'OpenZaak ist eine produktionstaugliche API-Plattform, die den API-Standard für fallorientiertes Arbeiten (die ZGW-APIs) implementiert.',
      configurationTitle: 'Konfigurationsname',
      clientId: 'Client ID',
      clientSecret: 'Secret',
    },
  },
};

export {openZaakPluginSpecification};
