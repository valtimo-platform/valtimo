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
import {OpenKlantTokenAuthenticationConfigurationComponent} from './components/open-klant-token-authentication-configuration/open-klant-token-authentication-configuration.component';
import {OPEN_KLANT_TOKEN_AUTHENTICATION_PLUGIN_LOGO_BASE64} from './assets/open-klant-token-authentication-plugin-logo';

const openKlantTokenAuthenticationPluginSpecification: PluginSpecification = {
  pluginId: 'openklanttokenauthentication',
  pluginConfigurationComponent: OpenKlantTokenAuthenticationConfigurationComponent,
  pluginLogoBase64: OPEN_KLANT_TOKEN_AUTHENTICATION_PLUGIN_LOGO_BASE64,

  pluginTranslations: {
    nl: {
      title: 'OpenKlant token authenticatie',
      description: 'Auhenticatie met behulp van tokens voor gebruik door OpenKlant.',
      configurationTitle: 'Configuratienaam',
      configurationTitleTooltip:
        'Onder deze naam zal de plug-in te herkennen zijn in de rest van de applicatie',
      token: 'Token',
      tokenTooltip:
        'Het token is een sleutel waarmee toestemmingen verleend zijn om specifieke open-klant data te mogen ophalen',
    },
    en: {
      title: 'OpenKlant token authentication',
      description: 'Authentication using tokens for use by OpenKlant.',
      configurationTitle: 'Configuration name',
      configurationTitleTooltip:
        'With this name the plugin will be recognizable in the rest of the application',
      token: 'Token',
      tokenTooltip: 'The token is a key that grants permissions to access specific open-klant data',
    },
    de: {
      title: 'OpenKlant Token-Authentifizierung',
      description: 'Authentifizierung mit Token zur Verwendung durch OpenKlant.',
      configurationTitle: 'Konfigurationsname',
      configurationTitleTooltip:
        'An diesem Namen wird das Plugin im Rest der Anwendung erkennbar sein',
      token: 'Token',
      tokenTooltip:
        'Das Token ist ein Schlüssel, der Berechtigungen zum Anzeigen bestimmter open-klant data erteilt',
    },
  },
};

export {openKlantTokenAuthenticationPluginSpecification};
