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
import {NotificatiesApiConfigurationComponent} from './components/notificaties-api-configuration/notificaties-api-configuration.component';
import {ReceiveNotificatieConfigurationComponent} from './components/receive-notificatie/receive-notificatie-configuration.component';
import {NOTIFICATIES_API_PLUGIN_LOGO_BASE64} from './assets/notificaties-api-plugin-logo';

const notificatiesApiPluginSpecification: PluginSpecification = {
  pluginId: 'notificatiesapi',
  pluginConfigurationComponent: NotificatiesApiConfigurationComponent,
  pluginLogoBase64: NOTIFICATIES_API_PLUGIN_LOGO_BASE64,
  functionConfigurationComponents: {
    'receive-notificatie': ReceiveNotificatieConfigurationComponent,
  },
  pluginTranslations: {
    nl: {
      title: 'Notificaties API',
      url: 'Notificaties API URL',
      urlTooltip: 'Een URL naar de REST API van Notificaties',
      callbackUrl: 'Callback URL',
      callbackUrlTooltip: 'Het GZAC API-endpoint waar notificaties naartoe moeten worden gestuurd.',
      description: 'Een API om een notificatierouteringscomponent te benaderen.',
      configurationTitle: 'Configuratienaam',
      configurationTitleTooltip:
        'De naam van de huidige plugin-configuratie. Onder deze naam kan de configuratie in de rest van de applicatie teruggevonden worden.',
      authenticationPluginConfiguration: 'Configuratie authenticatie-plug-in',
      authHeader: 'Authenticatie header (herstart server vereist)',
      authHeaderTooltip:
        'Secret van de authenticatie header voor de callback URL. Als niet ingevuld wordt een random secret gegenereerd. Het abonnement moet opnieuw worden aangemaakt (na een herstart van de applicatie).',
      'receive-notificatie': 'Ontvang een notificatie',
      receiveNotificatieDescription:
        'Configureer de filtercriteria voor binnenkomende notificaties. Alle velden zijn optioneel — lege velden matchen alle waarden.',
      receiveNotificatieWarningTitle: 'Vereisten',
      receiveNotificatieWarning:
        'Het kanaal moet bestaan in de Notificaties API en het abonnement moet zijn geconfigureerd om te filteren op de opgegeven kenmerken. Per kanaal kan alleen gefilterd worden op kenmerken die op het kanaal zijn gedefinieerd.',
      kanaal: 'Kanaal',
      receiveKanaalTooltip: 'Filter op kanaal. Indien leeg worden alle kanalen gematcht.',
      actie: 'Actie',
      receiveActieTooltip: 'Filter op actie. Indien leeg worden alle acties gematcht.',
      kenmerken: 'Kenmerken',
      receiveKenmerkenTooltip:
        'Filter op kenmerken. Alleen notificaties die alle opgegeven kenmerken bevatten worden gematcht.',
      kenmerkenKey: 'Kenmerk',
      kenmerkenValue: 'Waarde',
      kenmerkenAddRow: 'Kenmerk toevoegen',
      kenmerkenDeleteRow: 'Kenmerk verwijderen',
    },
    en: {
      title: 'Notificaties API',
      url: 'Notificaties API URL',
      urlTooltip: 'A URL to the REST API of Notificaties',
      callbackUrl: 'Callback URL',
      callbackUrlTooltip: 'The GZAC API-endpoint where notifications should be sent.',
      description: 'An API to access a notification routing component.',
      configurationTitle: 'Configuration name',
      configurationTitleTooltip:
        'The name of the current plugin configuration. Under this name, the configuration can be found in the rest of the application.',
      authenticationPluginConfiguration: 'Authentication plugin configuration',
      authHeader: 'Authentication header (restart server required)',
      authHeaderTooltip:
        'Secret value in Authentication header for the callback URL. When omitting this field, a random secret is generated. The abonnement needs to be recreated (after a restart of the application).',
      'receive-notificatie': 'Receive a notification',
      receiveNotificatieDescription:
        'Configure the filter criteria for incoming notifications. All fields are optional — empty fields match all values.',
      receiveNotificatieWarningTitle: 'Prerequisites',
      receiveNotificatieWarning:
        'The kanaal must exist in the Notificaties API and the subscription must be configured to filter on the specified kenmerken. Per kanaal, only kenmerken that are defined on the kanaal can be used as filters.',
      kanaal: 'Channel',
      receiveKanaalTooltip: 'Filter by channel. If empty, all channels are matched.',
      actie: 'Action',
      receiveActieTooltip: 'Filter by action. If empty, all actions are matched.',
      kenmerken: 'Attributes',
      receiveKenmerkenTooltip:
        'Filter by attributes. Only notifications containing all specified attributes are matched.',
      kenmerkenKey: 'Attribute',
      kenmerkenValue: 'Value',
      kenmerkenAddRow: 'Add attribute',
      kenmerkenDeleteRow: 'Delete attribute',
    },
  },
};

export {notificatiesApiPluginSpecification};
