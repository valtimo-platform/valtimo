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
import {CatalogiApiConfigurationComponent} from './components/catalogi-api-configuration/catalogi-api-configuration.component';
import {CATALOGI_API_PLUGIN_LOGO_BASE64} from './assets';
import {GetStatustypeConfigurationComponent} from './components/get-statustype/get-statustype-configuration.component';
import {GetBesluittypeConfigurationComponent} from './components/get-besluittype/get-besluittype-configuration.component';
import {GetResultaattypeConfigurationComponent} from './components/get-resultaattype/get-resultaattype-configuration.component';

const catalogiApiPluginSpecification: PluginSpecification = {
  pluginId: 'catalogiapi',
  pluginConfigurationComponent: CatalogiApiConfigurationComponent,
  pluginLogoBase64: CATALOGI_API_PLUGIN_LOGO_BASE64,
  functionConfigurationComponents: {
    'get-besluittype': GetBesluittypeConfigurationComponent,
    'get-resultaattype': GetResultaattypeConfigurationComponent,
    'get-statustype': GetStatustypeConfigurationComponent,
  },
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
      'get-statustype': 'Statustype opvragen',
      getStatustypeInformation:
        'De statustype wordt opgehaald en daarna opgeslagen in een process variable.',
      statustype: 'Statustype',
      statustypeTooltip: 'Generieke aanduiding van de aard van een status.',
      processVariable: 'Naam procesvariabele',
      processVariableTooltip:
        'Nadat de statustype is opgehaald, wordt deze opgeslagen in een process variable met deze naam.',
      'get-besluittype': 'Besluittype opvragen',
      getBesluittypeInformation:
        'Het besluittype wordt opgehaald en daarna opgeslagen in een process variable.',
      besluittype: 'Besluittype',
      besluittypeTooltip: 'Omschrijving van de aard van het besluit.',
      besluitProcessVariableTooltip:
        'Nadat de besluittype is opgehaald, wordt deze opgeslagen in een process variable met deze naam.',
      'get-resultaattype': 'Resultaattype opvragen',
      getResultaattypeInformation:
        'Het resultaattype wordt opgehaald en daarna opgeslagen in een process variable.',
      resultaattype: 'Resultaattype',
      resultaattypeTooltip: 'Omschrijving van de aard van het resultaat.',
      reslutaatProcessVariableTooltip:
        'Nadat de resultaattype is opgehaald, wordt deze opgeslagen in een process variable met deze naam.',
    },
    en: {
      title: 'Catalogi API',
      url: 'Catalogi API URL',
      urlTooltip: 'A URL to the REST API of Catalogi',
      description: 'API for storage and retrieval of zaaktype catalogs, zaaktypes and child types.',
      configurationTitle: 'Configuration name',
      configurationTitleTooltip:
        'The name of the current plugin configuration. Under this name, the configuration can be found in the rest of the application.',
      authenticationPluginConfiguration: 'Authentication plugin configuration',
      'get-statustype': 'Retrieve statustype',
      getStatustypeInformation:
        'The statustype is retrieved and then stored in a process variable.',
      statustype: 'Statustype',
      statustypeTooltip: 'Generic indication of the nature of a status.',
      processVariable: 'Process variable name',
      processVariableTooltip:
        'Once the statustype is retrieved, it is stored in a process variable with the given name.',
      'get-besluittype': 'Retrieve besluittype',
      getBesluittypeInformation:
        'The besluittype is retrieved and then stored in a process variable.',
      besluittype: 'Besluittype',
      besluittypeTooltip: 'Description of the nature of the decision.',
      besluitProcessVariableTooltip:
        'After the besluittype is retrieved, it is stored in a process variable with this name.',
      'get-resultaattype': 'Retrieve resultaattype',
      getResultaattypeInformation:
        'The resultaattype is retrieved and then stored in a process variable.',
      resultaattype: 'Resultaattype',
      resultaattypeTooltip: 'Description of the nature of the result.',
      reslutaatProcessVariableTooltip:
        'After the resultaattype is retrieved, it is stored in a process variable with this name.',
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
      'get-statustype': 'Statustype anfordern',
      getStatustypeInformation:
        'Der Statustyp wird abgerufen und dann in einer Prozessvariablen gespeichert.',
      statustype: 'Statustype',
      statustypeTooltip: 'Generische Angabe der Art eines Status.',
      processVariable: 'Prozessvariablenname',
      processVariableTooltip:
        'Sobald der Statustype abgerufen wurde, wird er in einer Prozessvariablen mit diesem Namen gespeichert.',
      'get-besluittype': 'Besluittype anfordern',
      getBesluittypeInformation:
        'Der besluittype wird abgerufen und dann in einer Prozessvariablen gespeichert.',
      besluittype: 'Besluittype',
      besluittypeTooltip: 'Beschreibung der Art der besluit.',
      besluitProcessVariableTooltip:
        'Sobald der besluittype abgerufen wurde, wird er in einer Prozessvariablen mit diesem Namen gespeichert.',
      'get-resultaattype': 'Resultaattype anfordern',
      getResultaattypeInformation:
        'Der resultaattype wird abgerufen und dann in einer Prozessvariablen gespeichert.',
      resultaattype: 'Resultaattype',
      resultaattypeTooltip: 'Beschreibung der Art der resultaat.',
      reslutaatProcessVariableTooltip:
        'Sobald der resultaattype abgerufen wurde, wird er in einer Prozessvariablen mit diesem Namen gespeichert.',
    },
  },
};

export {catalogiApiPluginSpecification};
