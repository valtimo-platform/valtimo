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
import {DocumentVerzoekConfigurationComponent} from './components/document-verzoek-configuration/document-verzoek-configuration.component';
import {DOCUMENT_VERZOEK_PLUGIN_LOGO_BASE64} from './assets/document-verzoek-plugin-logo';

const documentVerzoekPluginSpecification: PluginSpecification = {
  pluginId: 'document-verzoek',
  pluginConfigurationComponent: DocumentVerzoekConfigurationComponent,
  pluginLogoBase64: DOCUMENT_VERZOEK_PLUGIN_LOGO_BASE64,
  pluginTranslations: {
    nl: {
      title: 'Document Verzoek',
      description:
        'De document-verzoek-plugin verwerkt events uit de Notificaties API voor het buiten GZAC toevoegen van EnkelvoudigeInformatieobjecten aan een bestaande Zaak. Het event bevat de referenties naar de Zaak en het aangemaakte Zaakinformatieobject dat de relatie met het document vastlegt.',
      configurationTitle: 'Configuratienaam',
      configurationTitleTooltip:
        'De naam van de huidige plugin-configuratie. Onder deze naam kan de configuratie in de rest van de applicatie teruggevonden worden.',
      notificatiesApiPluginConfiguration: 'Notificaties API-configuratie',
      processToStart: 'Proces',
      rsin: 'RSIN',
      verzoekProperties: 'Verzoektypen',
      type: 'Type',
      caseDefinitionKey: 'Dossierdefinitie',
      caseDefinitionVersionTag: 'Dossierdefinitie versie',
      initiatorRoltypeUrl: 'Roltype',
      processDefinitionKey: 'Procesdefinitie',
      initiatorRolDescription: 'Rolbeschrijving',
      addVerzoekType: 'Document Verzoektype toevoegen',
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
      caseDefinitionKeyTooltip:
        'Selecteer hier het dossiertype waarvan een instantie gestart moet worden wanneer er een verzoek binnenkomt.',
      caseDefinitionVersionTagTooltip:
        'Vul hier de versie in van het dossiertype waarvan een instantie gestart moet worden wanneer er een verzoek binnenkomt.',
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
        'The document verzoek plugin processes events from the Notifications API for adding EnkelvoudigeInformatieobjecten to an existing Zaak outside of GZAC. The event contains references to the Zaak and the created Zaakinformatieobject that captures the relationship with the document.',
      configurationTitle: 'Configuration name',
      configurationTitleTooltip:
        'The name of the current plugin configuration. Under this name, the configuration can be found in the rest of the application.',
      notificatiesApiPluginConfiguration: 'Notificaties API configuration',
      objectManagementId: 'Object management configuration',
      processToStart: 'Process',
      rsin: 'RSIN',
      verzoekProperties: 'Case verzoek types',
      type: 'Type',
      caseDefinitionKey: 'Case definition',
      caseDefinitionVersionTag: 'Case definition version',
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
      caseDefinitionKeyTooltip:
        'The case type of which an instance should be started when a verzoek comes in.',
      caseDefinitionVersionTagTooltip:
        'The version of the case type of which an instance should be started when a verzoek comes in.',
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
  },
};

export {documentVerzoekPluginSpecification};
