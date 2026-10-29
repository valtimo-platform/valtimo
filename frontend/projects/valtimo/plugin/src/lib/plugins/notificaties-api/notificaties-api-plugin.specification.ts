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
import {PublishNotificatieConfigurationComponent} from './components/publish-notificatie/publish-notificatie-configuration.component';
import {ReceiveNotificatieConfigurationComponent} from './components/receive-notificatie/receive-notificatie-configuration.component';
import {NOTIFICATIES_API_PLUGIN_LOGO_BASE64} from './assets/notificaties-api-plugin-logo';

const notificatiesApiPluginSpecification: PluginSpecification = {
  pluginId: 'notificatiesapi',
  pluginConfigurationComponent: NotificatiesApiConfigurationComponent,
  pluginLogoBase64: NOTIFICATIES_API_PLUGIN_LOGO_BASE64,
  functionConfigurationComponents: {
    'publish-notificatie': PublishNotificatieConfigurationComponent,
    'receive-notificatie': ReceiveNotificatieConfigurationComponent,
  },
  pluginTranslations: {
    nl: {
      title: 'Notificaties API',
      url: 'Notificaties API URL',
      urlTooltip: 'Een URL naar de REST API van Notificaties',
      callbackUrl: 'Callback-URL',
      callbackUrlTooltip: 'Het GZAC API-endpoint waar notificaties naartoe moeten worden gestuurd.',
      description: 'Een API om een notificatierouteringscomponent te benaderen.',
      configurationTitle: 'Configuratienaam',
      configurationTitleTooltip:
        'De naam van de huidige pluginconfiguratie. Onder deze naam kan de configuratie in de rest van de applicatie teruggevonden worden.',
      authenticationPluginConfiguration: 'Configuratie authenticatieplugin',
      authHeader: 'Authenticatieheader (herstart server vereist)',
      authHeaderTooltip:
        'Secret in de authenticatieheader voor de callback-URL. Als dit veld leeg blijft, wordt een willekeurige secret gegenereerd. Het abonnement moet opnieuw worden aangemaakt (na een herstart van de applicatie).',
      'publish-notificatie': 'Notificatie publiceren',
      kanaal: 'Kanaal',
      kanaalTooltip: 'Het kanaal waarop de notificatie gepubliceerd wordt (max 50 tekens).',
      hoofdObject: 'Hoofdobject-URL',
      hoofdObjectTooltip: 'URL-referentie naar het hoofdobject van de publicerende API.',
      resource: 'Resource',
      resourceTooltip: 'De resourcenaam waar de notificatie betrekking op heeft (max 100 tekens).',
      resourceUrl: 'Resource-URL',
      resourceUrlTooltip: 'URL-referentie naar de resource in de publicerende API.',
      actie: 'Actie',
      actieTooltip: 'De actie die door de publicerende API is uitgevoerd (max 100 tekens).',
      aanmaakdatum: 'Aanmaakdatum',
      aanmaakdatumTooltip:
        'Tijdstip waarop de actie heeft plaatsgevonden (ISO 8601-formaat, bijv. 2024-01-15T10:30:00). Indien leeg wordt het huidige tijdstip gebruikt.',
      kenmerken: 'Kenmerken',
      kenmerkenTooltip: 'Sleutel-waardeparen voor het filteren van notificaties.',
      kenmerkenKey: 'Kenmerk',
      kenmerkenValue: 'Waarde',
      kenmerkenAddRow: 'Kenmerk toevoegen',
      kenmerkenDeleteRow: 'Kenmerk verwijderen',
      'receive-notificatie': 'Notificatie ontvangen',
      receiveNotificatieDescription:
        'Configureer de filtercriteria voor binnenkomende notificaties. Alle velden zijn optioneel — lege velden komen overeen met alle waarden.',
      receiveKanaalTooltip: 'Filter op kanaal. Laat leeg om alle kanalen toe te staan.',
      receiveActieTooltip: 'Filter op actie. Laat leeg om alle acties toe te staan.',
      receiveKenmerkenTooltip:
        'Filter op kenmerken. Alleen notificaties die alle opgegeven kenmerken bevatten, komen in aanmerking.',
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
      'publish-notificatie': 'Publish a notification',
      kanaal: 'Channel',
      kanaalTooltip: 'The channel on which the notification is published (max 50 characters).',
      hoofdObject: 'Main object URL',
      hoofdObjectTooltip: 'URL reference to the main object of the publishing API.',
      resource: 'Resource',
      resourceTooltip: 'The resource name the notification concerns (max 100 characters).',
      resourceUrl: 'Resource URL',
      resourceUrlTooltip: 'URL reference to the resource in the publishing API.',
      actie: 'Action',
      actieTooltip: 'The action performed by the publishing API (max 100 characters).',
      aanmaakdatum: 'Creation date',
      aanmaakdatumTooltip:
        'Timestamp when the action occurred (ISO 8601 format, e.g. 2026-01-15T10:30:00). If empty, the current time is used.',
      kenmerken: 'Attributes',
      kenmerkenTooltip: 'Key-value pairs for notification filtering.',
      kenmerkenKey: 'Attribute',
      kenmerkenValue: 'Value',
      kenmerkenAddRow: 'Add attribute',
      kenmerkenDeleteRow: 'Delete attribute',
      'receive-notificatie': 'Receive a notification',
      receiveNotificatieDescription:
        'Configure the filter criteria for incoming notifications. All fields are optional — empty fields match all values.',
      receiveKanaalTooltip: 'Filter by channel. If empty, all channels are matched.',
      receiveActieTooltip: 'Filter by action. If empty, all actions are matched.',
      receiveKenmerkenTooltip:
        'Filter by attributes. Only notifications containing all specified attributes are matched.',
    },
  },
};

export {notificatiesApiPluginSpecification};
