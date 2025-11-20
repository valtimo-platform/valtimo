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
import {CatalogiApiConfigurationComponent} from './components/catalogi-api-configuration/catalogi-api-configuration.component';
import {GetStatustypenConfigurationComponent} from './components/get-statustypen/get-statustypen-configuration.component';
import {GetStatustypeConfigurationComponent} from './components/get-statustype/get-statustype-configuration.component';
import {GetBesluittypeConfigurationComponent} from './components/get-besluittype/get-besluittype-configuration.component';
import {GetResultaattypenConfigurationComponent} from './components/get-resultaattypen/get-resultaattypen-configuration.component';
import {GetResultaattypeConfigurationComponent} from './components/get-resultaattype/get-resultaattype-configuration.component';
import {GetEigenschapConfigurationComponent} from './components/get-eigenschap/get-eigenschap-configuration.component';
import {CATALOGI_API_PLUGIN_LOGO_BASE64} from './assets';

const catalogiApiPluginSpecification: PluginSpecification = {
  pluginId: 'catalogiapi',
  pluginConfigurationComponent: CatalogiApiConfigurationComponent,
  pluginLogoBase64: CATALOGI_API_PLUGIN_LOGO_BASE64,
  functionConfigurationComponents: {
    'get-besluittype': GetBesluittypeConfigurationComponent,
    'get-resultaattypen': GetResultaattypenConfigurationComponent,
    'get-resultaattype': GetResultaattypeConfigurationComponent,
    'get-statustypen': GetStatustypenConfigurationComponent,
    'get-statustype': GetStatustypeConfigurationComponent,
    'get-eigenschap': GetEigenschapConfigurationComponent,
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
      'get-statustypen': 'Statustypen opvragen',
      getStatustypenInformation:
        'De Statustypen behorende bij het Zaaktype worden opgehaald en daarna opgeslagen in een procesvariabele.',
      'get-statustype': 'Statustype opvragen',
      getStatustypeInformation:
        'De statustype wordt opgehaald en daarna opgeslagen in een procesvariabele.',
      statustype: 'Statustype',
      statustypeTooltip: 'Generieke aanduiding van de aard van een status.',
      processVariable: 'Naam procesvariabele',
      processVariableTooltip:
        'Nadat de statustype is opgehaald, wordt deze opgeslagen in een procesvariabele met deze naam.',
      'get-besluittype': 'Besluittype opvragen',
      getBesluittypeInformation:
        'Het besluittype wordt opgehaald en daarna opgeslagen in een procesvariabele.',
      besluittype: 'Besluittype',
      besluittypeTooltip: 'Omschrijving van de aard van het besluit.',
      besluitProcessVariableTooltip:
        'Nadat de besluittype is opgehaald, wordt deze opgeslagen in een procesvariabele met deze naam.',
      'get-resultaattypen': 'Resultaattypen opvragen',
      getResultaattypenInformation:
        'De Resultaattypen behorende bij het Zaaktype worden opgehaald en daarna opgeslagen in een procesvariabele.',
      'get-resultaattype': 'Resultaattype opvragen',
      getResultaattypeInformation:
        'Het resultaattype wordt opgehaald en daarna opgeslagen in een procesvariabele.',
      resultaattype: 'Resultaattype',
      resultaattypeTooltip: 'Omschrijving van de aard van het resultaat.',
      reslutaatProcessVariableTooltip:
        'Nadat de resultaattype is opgehaald, wordt deze opgeslagen in een procesvariabele met deze naam.',
      'get-eigenschap': 'Eigenschap opvragen',
      getEigenschapInformation:
        'De eigenschap wordt opgehaald en daarna opgeslagen in een procesvariabele',
      eigenschap: 'Eigenschap',
      eigenschapTooltip: 'Naam van de aard van het eigenschaap.',
      eigenschapProcessVariableTooltip:
        'Nadat de eigenschap is opgehaald, wordt deze opgeslagen in een procesvariabele met deze naam.',
      zaakTypeUrl: 'Zaaktype URL',
      zaakTypeUrlTooltip:
        'Specificeer hier de URL van het betreffende Zaaktype indien deze afwijkt van de aan het Dossier gekoppelde Zaak',
    },
    en: {
      title: 'Catalogi API',
      url: 'Catalogi API URL',
      urlTooltip: 'A URL to the REST API of Catalogi',
      description: 'API for storage and retrieval of Zaaktype catalogs, Zaaktypen and child types.',
      configurationTitle: 'Configuration name',
      configurationTitleTooltip:
        'The name of the current plugin configuration. Under this name, the configuration can be found in the rest of the application.',
      authenticationPluginConfiguration: 'Authentication plugin configuration',
      'get-statustypen': 'Retrieve statustypen',
      getStatustypenInformation:
        'The Statustypen belonging to the Zaaktype are retrieved and then stored in a process variable.',
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
      'get-resultaattypen': 'Retrieve resultaattypen',
      getResultaattypenInformation:
        'The Resultaattypen belonging to the Zaak type are retrieved and then stored in a process variable.',
      'get-resultaattype': 'Retrieve resultaattype',
      getResultaattypeInformation:
        'The resultaattype is retrieved and then stored in a process variable.',
      resultaattype: 'Resultaattype',
      resultaattypeTooltip: 'Description of the nature of the result.',
      reslutaatProcessVariableTooltip:
        'After the resultaattype is retrieved, it is stored in a process variable with this name.',
      'get-eigenschap': 'Retrieve eigenschap',
      getEigenschapInformation: 'The eigenschap is retrieved and then stored in a process variable',
      eigenschap: 'Eigenschap',
      eigenschapTooltip: 'Name of the nature of the eigenschap.',
      eigenschapProcessVariableTooltip:
        'After the eigenschap is retrieved, it is stored in a process variable with this name.',
      zaakTypeUrl: 'Zaaktype URL',
      zaakTypeUrlTooltip:
        'Specify the URL of the relevant Zaaktype here if it differs from the Zaak linked to the Case',
    },
  },
};

export {catalogiApiPluginSpecification};
