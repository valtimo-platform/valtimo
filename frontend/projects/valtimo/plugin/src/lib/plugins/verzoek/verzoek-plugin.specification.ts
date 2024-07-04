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
import {VerzoekConfigurationComponent} from './components/verzoek-configuration/verzoek-configuration.component';
import {VERZOEK_PLUGIN_LOGO_BASE64} from './assets/verzoek-plugin-logo';

const verzoekPluginSpecification: PluginSpecification = {
  pluginId: 'verzoek',
  pluginConfigurationComponent: VerzoekConfigurationComponent,
  pluginLogoBase64: VERZOEK_PLUGIN_LOGO_BASE64,
  pluginTranslations: {
    nl: {
      title: 'Verzoek',
      description:
        'De Verzoek-plugin handelt aanvragen af en maakt een Zaakdossier aan. Een Verzoek is een Object in de Objecten API en wordt meestal met behulp van een portaal aangemaakt.',
      configurationTitle: 'Configuratienaam',
      configurationTitleTooltip:
        'De naam van de huidige plugin-configuratie. Onder deze naam kan de configuratie in de rest van de applicatie teruggevonden worden.',
      notificatiesApiPluginConfiguration: 'Notificaties API-configuratie',
      objectManagementId: 'Object management-configuratie',
      processToStart: 'Proces',
      rsin: 'RSIN',
      verzoekProperties: 'Verzoektypen',
      type: 'Type',
      caseDefinitionName: 'Dossierdefinitie',
      initiatorRoltypeUrl: 'Roltype',
      processDefinitionKey: 'Procesdefinitie',
      initiatorRolDescription: 'Rolbeschrijving',
      addVerzoekType: 'Verzoektype toevoegen',
      verzoekPropertiesTooltip:
        'De verzoektypen die aangemaakt worden wannneer er een notificatie binnenkomt.',
      notificatiesApiPluginConfigurationTooltip:
        'Configuratie van de Notificaties API die wordt gebruikt om te communiceren tussen GZAC en andere applicaties.',
      objectManagementIdTooltip:
        'Configuratie van het object dat wordt gebruikt om een verzoek op te slaan.',
      processToStartTooltip: 'Het proces dat een zaak aanmaakt wanneer een notificatie binnenkomt.',
      rsinTooltip: 'Dit nummer moet voldoen aan dezelfde specificaties als een BSN-nummer.',
      typeTooltip:
        "Het type van het verzoek dat wordt gebruikt om het object te identificeren. Bv. 'verzoek'.",
      caseDefinitionNameTooltip:
        'Selecteer hier het dossiertype waarvan een instantie gestart moet worden wanneer er een verzoek binnenkomt.',
      initiatorRoltypeUrlTooltip:
        'Het roltype van de aanvrager die wordt opgeslagen wanneer er een verzoek binnenkomt.',
      initiatorRolDescriptionTooltip:
        'Een beschrijving van het roltype van de aanvrager die wordt opgeslagen wanneer er een verzoek binnenkomt.',
      processDefinitionKeyTooltip:
        'Selecteer hier het proces dat gestart moet worden wanneer het eerder geselecteerde systeemproces afgerond is.',
      copyStrategy: 'Kopieerstrategie',
      copyStrategyTooltip:
        'Met deze optie wordt bepaald of het volledige Verzoek-object in het document terecht komt, of slechts de gespecifieerde velden.',
      full: 'Volledig',
      specified: 'Gespecifieerde velden',
      mapping: 'Mapping',
      setMapping: 'Mapping instellen',
      mappingTooltip:
        "Stel hier de velden in die gekopieerd moeten worden van het Verzoek-object naar het document. Bijvoorbeeld: '/voorletters' -> 'doc:/voorletters-machtiginggever'.",
      close: 'Sluiten',
      save: 'Opslaan',
      target: 'Bestemming',
      source: 'Bron',
    },
    en: {
      title: 'Verzoek',
      description:
        'The Verzoek plugin handles requests and creates a Zaakdossier. A Verzoek is an Object in the Objecten API and is usually created using a portal.',
      configurationTitle: 'Configuration name',
      configurationTitleTooltip:
        'The name of the current plugin configuration. Under this name, the configuration can be found in the rest of the application.',
      notificatiesApiPluginConfiguration: 'Notificaties API configuration',
      objectManagementId: 'Object management configuration',
      processToStart: 'Process',
      rsin: 'RSIN',
      verzoekProperties: 'Verzoek types',
      type: 'Type',
      caseDefinitionName: 'Case definition',
      initiatorRoltypeUrl: 'Role type',
      processDefinitionKey: 'Process definition',
      initiatorRolDescription: 'Role description',
      addVerzoekType: 'Add verzoek type',
      verzoekPropertiesTooltip:
        'The verzoek types that are created when a notification is received.',
      notificatiesApiPluginConfigurationTooltip:
        'Configuration of the Notificaties API used to communicate between GZAC and other applications.',
      objectManagementIdTooltip: 'Configuration of the object used to store a verzoek.',
      processToStartTooltip: 'The process that creates a case when a notification is received.',
      rsinTooltip: 'This number must meet the same specifications as a BSN number.',
      typeTooltip: "The type of verzoek used to identify the object. Eg. 'verzoek'.",
      caseDefinitionNameTooltip:
        'The case type of which an instance should be started when a verzoek comes in.',
      initiatorRoltypeUrlTooltip:
        'The role type of the requestor that is saved when a verzoek comes in.',
      initiatorRolDescriptionTooltip:
        "A description of the requester's role type that is saved when a verzoek comes in.",
      processDefinitionKeyTooltip:
        'Select the process that should be started when the previously selected system process has finished.',
      copyStrategy: 'Copy strategy',
      copyStrategyTooltip:
        'This option determines whether the entire Verzoek object is included in the document, or only the defined fields.',
      full: 'Complete',
      specified: 'Specified fields',
      mapping: 'Mapping',
      setMapping: 'Set mapping',
      mappingTooltip:
        "Set the fields to be copied from the Verzoek object to the document. For example: '/voorletters' -> 'doc:/voorletters-machtiginggever'.",
      close: 'Close',
      save: 'Save',
      target: 'Target',
      source: 'Source',
    },
    de: {
      title: 'Verzoek',
      description:
        'Das Verzoek-Plugin verarbeitet Anfragen und erstellt eine Zaakdossier. Eine Verzoek ist ein Object in der Objecten API und wird normalerweise mithilfe eines Portals erstellt.',
      configurationTitle: 'Konfigurationsname',
      configurationTitleTooltip:
        'Der Name der aktuellen Plugin-Konfiguration. Unter diesem Namen ist die Konfiguration im Rest der Anwendung zu finden.',
      notificatiesApiPluginConfiguration: 'Notificaties API-Konfiguration',
      objectManagementId: 'Object management-Konfiguration',
      processToStart: 'Prozess',
      rsin: 'RSIN',
      verzoekProperties: 'Verzoektypen',
      type: 'Typ',
      caseDefinitionName: 'Dateidefinition',
      initiatorRoltypeUrl: 'Rollentyp',
      processDefinitionKey: 'Prozessdefinition',
      initiatorRolDescription: 'Rollenbeschreibung',
      addVerzoekType: 'Verzoektyp hinzufügen',
      verzoekPropertiesTooltip:
        'Die Verzoektypen die erstellt werden wenn eine Benachrichtigung eintrifft.',
      notificatiesApiPluginConfigurationTooltip:
        'Konfiguration der Notificaties API, die für die Kommunikation zwischen GZAC und anderen Anwendungen verwendet wird.',
      objectManagementIdTooltip:
        'Konfiguration des Objects, das zum Speichern einer Verzoek verwendet wird.',
      processToStartTooltip:
        'Der Prozess, der einen Fall erstellt, wenn eine Benachrichtigung eintrifft.',
      rsinTooltip: 'Diese Nummer muss die gleichen Spezifikationen wie eine BSN-Nummer erfüllen.',
      typeTooltip:
        "Der Verzoektyp, der zum Identifizieren des Objects verwendet wird. Z.B. 'verzoek'.",
      caseDefinitionNameTooltip:
        'Wählen Sie hier den Falltyp aus, von dem eine Instanz gestartet werden soll, wenn eine Verzoek eintrifft.',
      initiatorRoltypeUrlTooltip:
        'Der Rollentyp des Anforderers, der gespeichert wird, wenn eine Verzoek eingeht.',
      initiatorRolDescriptionTooltip:
        'Eine Beschreibung des Rollentyps des Anforderers, die gespeichert wird, wenn eine Verzoek eingeht.',
      processDefinitionKeyTooltip:
        'Wählen Sie hier den Prozess aus, der gestartet werden soll, wenn der zuvor ausgewählte Systemprozess beendet ist.',
      copyStrategy: 'Kopierstrategie',
      copyStrategyTooltip:
        'Diese Option legt fest, ob das gesamte Verzoek-Objekt in das Dokument aufgenommen wird oder nur die definierten Felder.',
      full: 'Vollständig',
      specified: 'Angegebene Felder',
      mapping: 'Mapping',
      setMapping: 'Mapping festlegen',
      mappingTooltip:
        "Legen Sie hier die Felder fest, die vom Verzoek-Objekt in das Dokument kopiert werden sollen. Zum Beispiel: '/voorletters' -> 'doc:/voorletters-machtiginggever'.",
      close: 'Schließen',
      save: 'Speichern',
      target: 'Ziel',
      source: 'Ursprung',
    },
  },
};

export {verzoekPluginSpecification};
