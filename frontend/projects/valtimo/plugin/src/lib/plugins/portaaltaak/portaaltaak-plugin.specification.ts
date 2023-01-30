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
import {PortaaltaakConfigurationComponent} from './components/portaaltaak-configuration/portaaltaak-configuration.component';
import {PORTAALTAAK_PLUGIN_LOGO_BASE64} from './assets/portaaltaak-plugin-logo';

const portaaltaakPluginSpecification: PluginSpecification = {
  pluginId: 'portaaltaak',
  pluginConfigurationComponent: PortaaltaakConfigurationComponent,
  pluginLogoBase64: PORTAALTAAK_PLUGIN_LOGO_BASE64,
  pluginTranslations: {
    nl: {
      title: 'Portaaltaak',
      description: 'Een component om een portaaltaakrouteringscomponent te benaderen.',
      configurationTitle: 'Configuratienaam',
      configurationTitleTooltip:
        'De naam van de huidige plugin-configuratie. Onder deze naam kan de configuratie in de rest van de applicatie teruggevonden worden.',
      notificatiesApiPluginConfiguration: 'Notificaties API plugin',
      notificatiesApiPluginConfigurationTooltip:
        'Selecteer de Notificaties API plugin. Wanneer de selectiebox leeg us, zal de notificatie API plugin eerst aangemaakt moeten worden.',
      objectManagementConfiguration: 'Object management configuratie',
      objectManagementConfigurationTooltip:
        'Selecteer de gewenste object management configuratie. Wanneer de selectiebox leeg is, zal de object management configuratie eerst aangemaakt moeten worden.',
    },
    en: {
      title: 'Portal task',
      description: 'A component to access a portal task routing component.',
      configurationTitle: 'Configuration name',
      configurationTitleTooltip:
        'The name of the current plugin configuration. Under this name, the configuration can be found in the rest of the application.',
      notificatiesApiPluginConfiguration: 'Notification API plugin',
      notificatiesApiPluginConfigurationTooltip:
        'Select the Notifications API plugin. If the selection box remains empty, the Notifications API plugin will first have to be created.',
      objectManagementConfiguration: 'Object management configuration',
      objectManagementConfigurationTooltip:
        'Select the object management configuration. If the selection box remains empty, the object management configuration will first have to be created.',
    },
    de: {
      title: 'Portalaufgabe',
      description:
        'Eine Komponente für den Zugriff auf eine Portal-Aufgabenweiterleitungskomponente.',
      configurationTitle: 'Konfigurationsname',
      configurationTitleTooltip:
        'Der Name der aktuellen Plugin-Konfiguration. Unter diesem Namen ist die Konfiguration im Rest der Anwendung zu finden.',
      notificatiesApiPluginConfiguration: 'Benachrichtigungs-API plugin',
      notificatiesApiPluginConfigurationTooltip:
        'Wählen Sie das Benachrichtigungs-API-Plugin aus. Bleibt das Auswahlfeld leer, muss das Benachrichtigungs-API-Plugin erst erstellt werden',
      objectManagementConfiguration: 'Objektverwaltungskonfiguration',
      objectManagementConfigurationTooltip:
        'Wählen Sie die Objektverwaltungskonfiguration aus. Bleibt das Auswahlfeld leer, muss zunächst die Objektverwaltungskonfiguration erstellt werden.',
    },
  },
};

export {portaaltaakPluginSpecification};
