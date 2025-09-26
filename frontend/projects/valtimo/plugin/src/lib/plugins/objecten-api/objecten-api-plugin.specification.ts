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

import {PluginSpecification} from '../../models';
import {ObjectenApiConfigurationComponent} from './components/objecten-api-configuration/objecten-api-configuration.component';
import {OBJECTEN_API_PLUGIN_LOGO_BASE64} from './assets';
import {DeleteObjectComponent} from './components/delete-object/delete-object.component';

const objectenApiPluginSpecification: PluginSpecification = {
  pluginId: 'objectenapi',
  pluginConfigurationComponent: ObjectenApiConfigurationComponent,
  pluginLogoBase64: OBJECTEN_API_PLUGIN_LOGO_BASE64,
  functionConfigurationComponents: {
    'delete-object': DeleteObjectComponent,
  },
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
      'delete-object': 'Object verwijderen',
      deleteObjectWarning:
        'Waarschuwing: de objecten die met deze actie verwijderd worden mogen niet gekoppeld zijn aan een Zaak.',
      objectUrl: 'Object URL',
      objectUrlTooltip:
        "De URL van het object dat verwijderd moet worden uit de Objecten API. De ingevoerde waarde mag een procesvariable zijn, bijvoorbeeld: 'pv:object'.",
    },
    en: {
      title: 'Objecten API',
      url: 'Objecten API URL',
      urlTooltip: 'A URL to the REST API of Objects',
      description:
        'With the Other Objects Registration API specifications (Objects), municipalities can unambiguously register, store and access objects.',
      configurationTitle: 'Configuration name',
      configurationTitleTooltip:
        'With this name the plugin will be recognizable in the rest of the application',
      authenticationPluginConfiguration: 'Authentication plugin configuration',
      'delete-object': 'Delete object',
      deleteObjectWarning:
        'Warning: the objects that are deleted with this action must not be linked to a Zaak.',
      objectUrl: 'Object URL',
      objectUrlTooltip:
        "The URL of the object to be removed from the Objecten API. The value entered may be a process variable, for example: 'pv:object'.",
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
      'delete-object': 'Objekt löschen',
      deleteObjectWarning:
        'Achtung: Die Objekte, die mit dieser Aktion gelöscht werden, dürfen nicht mit einem Zaak verknüpft werden.',
      objectUrl: 'Objekt URL',
      objectUrlTooltip:
        "Die URL des Objekts, das aus der Objecten API entfernt werden soll. Der eingegebene Wert kann eine Prozessvariable sein, zum Beispiel: 'pv:object'.",
    },
  },
};

export {objectenApiPluginSpecification};
