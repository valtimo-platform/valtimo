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
import {SmartDocumentsConfigurationComponent} from './components/smart-documents-configuration/smart-documents-configuration.component';
import {SMART_DOCUMENTS_PLUGIN_LOGO_BASE64} from './assets';
import {GenerateDocumentConfigurationComponent} from './components/generate-document-configuration/generate-document-configuration.component';
import {GetTemplateNamesComponent} from './components/get-template-names/get-template-names.component';

const smartDocumentsPluginSpecification: PluginSpecification = {
  pluginId: 'smartdocuments',
  pluginConfigurationComponent: SmartDocumentsConfigurationComponent,
  pluginLogoBase64: SMART_DOCUMENTS_PLUGIN_LOGO_BASE64,
  functionConfigurationComponents: {
    'generate-document': GenerateDocumentConfigurationComponent,
    'get-template-names': GetTemplateNamesComponent,
  },
  pluginTranslations: {
    nl: {
      title: 'SmartDocuments',
      description: 'Automatiseer documenten met slimme templates.',
      'generate-document': 'Document genereren',
      'get-template-names': 'Templatenamen ophalen',
      configurationTitle: 'Configuratienaam',
      configurationTitleTooltip:
        'Onder deze naam zal de plugin te herkennen zijn in de rest van de applicatie',
      url: 'SmartDocuments URL',
      username: 'Gebruikersnaam',
      password: 'Wachtwoord',
      templateGroup: 'Template groep',
      templateName: 'Template naam',
      templateGroupName: 'Template groepsnaam',
      resultingTemplateNameListProcessVariableName:
        'Naam van process variable om lijst in op te slaan',
      templateDataTooltip:
        'De rechter value-kolom ondersteunt ook het gebruik van procesvariabelen zoals pv: en doc:',
      format: 'Documentformaat',
      templateData: 'Template-data',
      resultingDocumentProcessVariableName: 'Naam procesvariabele voor opslag document',
      resultingDocumentProcessVariableNameTooltip:
        'De locatie van het gegenereerde document wordt opgeslagen in een procesvariabele. Deze procesvariabele kan gebruikt worden om het document te verwerken in een andere BPMN-taak.',
      generateDocumentWarning:
        'Deze actie genereert een tijdelijk bestand. Het verwerken hiervan moet door een andere actie worden gedaan.',
      key: 'Sleutel',
      value: 'Waarde',
    },
    en: {
      title: 'SmartDocuments',
      description: 'Automate documents with smart templates.',
      'generate-document': 'Generate document',
      'get-template-names': 'Get Template Names',
      configurationTitle: 'Configuration name',
      configurationTitleTooltip:
        'With this name the plugin will be recognizable in the rest of the application',
      url: 'SmartDocuments URL',
      username: 'Username',
      password: 'Password',
      templateGroup: 'Template group',
      templateName: 'Template name',
      templateGroupName: 'Template group name',
      resultingTemplateNameListProcessVariableName: 'Name of process variable to save the list in',

      format: 'Document format',
      templateData: 'Template data',
      templateDataTooltip:
        'The right value-column also supports the use of process variables such as pv: and doc:',
      resultingDocumentProcessVariableName: 'Process variable name for storing document',
      resultingDocumentProcessVariableNameTooltip:
        'The location of the generated document is stored in a process variable. This process variable can be used to access the document in another BPMN task.',
      generateDocumentWarning:
        'This action generates a temporary file. It needs to be stored in a following task.',
      key: 'Key',
      value: 'Value',
    },
  },
};

export {smartDocumentsPluginSpecification};
