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
import {KlantinteractiesApiConfigurationComponent} from './components/klantinteracties-api-configuration/klantinteracties-api-configuration.component';
import {KLANTINTERACTIES_API_PLUGIN_LOGO_BASE64} from './assets';
import {CreatePersoonComponent} from './components/create-persoon/create-persoon.component';

const klantinteractiesApiPluginSpecification: PluginSpecification = {
  pluginId: 'klantinteractiesapi',
  pluginConfigurationComponent: KlantinteractiesApiConfigurationComponent,
  pluginLogoBase64: KLANTINTERACTIES_API_PLUGIN_LOGO_BASE64,
  functionConfigurationComponents: {
    'create-persoon': CreatePersoonComponent,
  },
  pluginTranslations: {
    nl: {
      title: 'Klantinteracties API',
      url: 'Klantinteracties API URL',
      urlTooltip: 'De URL naar de REST API voor klantinteracties.',
      description:
        'Met de specificaties van de Klantinteracties API kunnen gemeenten klantinteracties eenduidig registreren, opslaan en ontsluiten.',
      configurationTitle: 'Configuratienaam',
      configurationTitleTooltip:
        'Onder deze naam is de plug-in herkenbaar in de rest van de applicatie.',
      authenticationPluginConfiguration: 'Configuratie van authenticatie-plug-in',
      'create-persoon': 'Persoon aanmaken',
      bsn: 'BSN',
      bsnTooltip: 'Burgerservicenummer.',
      voorletters: 'Voorletters',
      voornaam: 'Voornaam',
      voorvoegselAchternaam: 'Voorvoegsel achternaam',
      achternaam: 'Achternaam',
      processVariableName: 'Naam van procesvariabele voor opslag van persoon-URL',
      processVariableNameTooltip:
        'De URL van de persoon wordt opgeslagen in een procesvariabele. Deze variabele kan worden gebruikt om verdere interacties met de persoon vast te leggen in een andere BPMN-taak.',
    },
    en: {
      title: 'Klantinteracties API',
      url: 'Klantinteracties API URL',
      urlTooltip: 'The URL of the REST API for Klantinteracties.',
      description:
        'The Klantinteracties API specifications allow municipalities to consistently record, store, and retrieve customer interactions.',
      configurationTitle: 'Configuration Name',
      configurationTitleTooltip: 'This name identifies the plug-in throughout the application.',
      authenticationPluginConfiguration: 'Authentication Plug-in Configuration',
      'create-persoon': 'Create Person',
      bsn: 'BSN',
      bsnTooltip: 'Citizen Service Number.',
      voorletters: 'Initials',
      voornaam: 'First Name',
      voorvoegselAchternaam: 'Prefix Last Name',
      achternaam: 'Last Name',
      processVariableName: 'Process Variable Name for Storing Person URL',
      processVariableNameTooltip:
        "The person's URL is stored in a process variable. This variable can be used to log further interactions with the person in another BPMN task.",
    },
    de: {
      title: 'Klantinteracties API',
      url: 'Klantinteracties API-URL',
      urlTooltip: 'Die URL der REST-API für Klantinteracties.',
      description:
        'Mit den Spezifikationen der Klantinteracties-API können Kommunen Kundeninteraktionen einheitlich erfassen, speichern und bereitstellen.',
      configurationTitle: 'Konfigurationsname',
      configurationTitleTooltip:
        'Unter diesem Namen ist das Plug-in in der gesamten Anwendung erkennbar.',
      authenticationPluginConfiguration: 'Konfiguration des Authentifizierungs-Plug-ins',
      'create-persoon': 'Person erstellen',
      bsn: 'BSN',
      bsnTooltip: 'Bürger-Service-Nummer.',
      voorletters: 'Initialen',
      voornaam: 'Vorname',
      voorvoegselAchternaam: 'Namensvorsatz Nachname',
      achternaam: 'Nachname',
      processVariableName: 'Name der Prozessvariablen zur Speicherung der Personen-URL',
      processVariableNameTooltip:
        'Die URL der Person wird in einer Prozessvariablen gespeichert. Diese Variable kann verwendet werden, um weitere Interaktionen mit der Person in einer anderen BPMN-Aufgabe zu erfassen.',
    },
  },
};

export {klantinteractiesApiPluginSpecification};
