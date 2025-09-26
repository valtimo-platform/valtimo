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

import {TokenAuthenticationConfigurationComponent} from './components/token-authentication-configuration/token-authentication-configuration.component';
import {TOKEN_AUTHENTICATION_PLUGIN_LOGO_BASE64} from './assets';
import {PluginSpecification} from '../../models'


const tokenAuthenticationPluginSpecification: PluginSpecification = {
  pluginId: 'tokenauthentication',
  pluginConfigurationComponent: TokenAuthenticationConfigurationComponent,
  pluginLogoBase64: TOKEN_AUTHENTICATION_PLUGIN_LOGO_BASE64,

  pluginTranslations: {
    nl: {
      title: 'Token authenticatie',
      description:
        'Plugin die gebruikt kan worden door ander plugins om via de Authorization header met een token te authenticeren.',
      configurationTitle: 'Configuratienaam',
      configurationTitleTooltip:
        'Token authenticatie',
      token: 'Token',
      tokenTooltip:
        'Het token wordt in de Authorization header meegegeven met de prefix "Token "',
    },
    en: {
      title: 'Token authentication',
      description: 'Plugin that can be used by other plugins to authenticate via the Authorization header with a token.',
      configurationTitle: 'Configuration name',
      configurationTitleTooltip:
        'Token authentication',
      token: 'Token',
      tokenTooltip:
        'The token is included in the Authorization header with "Token " as prefix',
    },
    de: {
      title: 'Token-Authentifizierung',
      description:
        'Plugin, das von anderen Plugins verwendet werden kann, um über den Authorization-Header mit einem Token zu authentifizieren.',
      configurationTitle: 'Konfigurationsname',
      configurationTitleTooltip:
        'Token-Authentifizierung',
      token: 'Token',
      tokenTooltip:
        'Das Token wird im Authorization-Header mitgegeben mit prefix "Token "',
    },
  },
};

export {tokenAuthenticationPluginSpecification};
